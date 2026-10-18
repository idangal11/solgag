'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { notifyVerificationDecision } from '@/lib/notify';
import { z } from 'zod';
import type { ActionResult } from '@/components/admin/types';
import { STORAGE_BUCKETS } from '@/lib/config';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from './_lib/data';

// Admin mutations. Each one re-checks the admin flag server-side; RLS, the
// listings_guard trigger and the review_verification RPC enforce it again in
// the database.

const SIGNED_URL_SECONDS = 10 * 60;

const idSchema = z.uuid();
const statusSchema = z.enum(['published', 'hidden']);
const techSchema = z.enum(['not_assessed', 'owner_reported', 'survey_planned', 'assessed']);
const reviewSchema = z.object({
  requestId: z.uuid(),
  approve: z.boolean(),
  note: z.string().trim().max(1000, 'הערת הבודק ארוכה מדי (עד 1000 תווים)'),
});

const BAD_ID = { ok: false, error: 'מזהה לא תקין' } as const;

/** Hebrew text for a database error. Domain triggers already raise Hebrew messages. */
function hebrewError(error: { message: string; code?: string }, fallback = 'הפעולה נכשלה. נסו שוב בעוד רגע.'): string {
  if (error.code === '42501') return 'אין לך הרשאה לבצע פעולה זו.';
  if (error.code === 'P0002') return 'הבקשה לא נמצאה או שכבר טופלה. רעננו את הדף.';
  if (/[֐-׿]/.test(error.message)) return error.message;
  console.error('[admin]', error);
  return fallback;
}

/** Verification badges and listing visibility show up across the whole site. */
function revalidateSite() {
  revalidatePath('/', 'layout');
}

/** Short-lived link to an ownership document. The path is looked up here, never taken from the client. */
export async function getVerificationDocumentUrl(requestId: string): Promise<ActionResult<{ url: string }>> {
  await requireAdmin();
  const id = idSchema.safeParse(requestId);
  if (!id.success) return BAD_ID;

  const supabase = await createClient();
  const { data, error } = await supabase.from('verification_requests').select('document_path').eq('id', id.data).maybeSingle();
  if (error) return { ok: false, error: hebrewError(error) };
  if (!data) return { ok: false, error: 'הבקשה לא נמצאה.' };

  const { data: signed, error: signError } = await supabase.storage
    .from(STORAGE_BUCKETS.ownershipDocs)
    .createSignedUrl((data as { document_path: string }).document_path, SIGNED_URL_SECONDS);
  if (signError || !signed) {
    console.error('[admin] createSignedUrl', signError);
    return { ok: false, error: 'לא הצלחנו לפתוח את המסמך. ייתכן שהקובץ הוסר מהאחסון.' };
  }
  return { ok: true, url: signed.signedUrl };
}

export async function reviewVerificationRequest(input: { requestId: string; approve: boolean; note: string }): Promise<ActionResult> {
  await requireAdmin();
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'קלט לא תקין' };
  const { requestId, approve, note } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc('review_verification', {
    p_request: requestId,
    p_approve: approve,
    p_note: note || null,
  });
  if (error) return { ok: false, error: hebrewError(error) };
  // Email the owner after the response is sent (no-op when email is not configured).
  after(() => notifyVerificationDecision({ requestId }));
  revalidateSite();
  return { ok: true };
}

async function updateListing(listingId: string, patch: { status: string } | { tech_assessment: string }): Promise<ActionResult> {
  const supabase = await createClient();
  // .select() makes a row filtered out by RLS (or already deleted) visible as "0 rows" instead of silent success.
  const { data, error } = await supabase.from('listings').update(patch).eq('id', listingId).select('id');
  if (error) return { ok: false, error: hebrewError(error) };
  if (!data?.length) return { ok: false, error: 'המודעה לא נמצאה. ייתכן שנמחקה.' };
  revalidateSite();
  return { ok: true };
}

export async function setListingStatus(listingId: string, status: string): Promise<ActionResult> {
  await requireAdmin();
  const id = idSchema.safeParse(listingId);
  const value = statusSchema.safeParse(status);
  if (!id.success || !value.success) return BAD_ID;
  return updateListing(id.data, { status: value.data });
}

/** All four values are open to admins; 'assessed' must follow an actual technical survey (the UI says so and confirms). */
export async function setListingTechAssessment(listingId: string, techAssessment: string): Promise<ActionResult> {
  await requireAdmin();
  const id = idSchema.safeParse(listingId);
  const value = techSchema.safeParse(techAssessment);
  if (!id.success || !value.success) return BAD_ID;
  if (value.data === 'assessed') {
    // A fictional listing has no real roof that could have been surveyed.
    const supabase = await createClient();
    const { data, error } = await supabase.from('listings').select('is_fictional').eq('id', id.data).maybeSingle();
    if (error) return { ok: false, error: hebrewError(error) };
    if ((data as { is_fictional: boolean } | null)?.is_fictional) {
      return { ok: false, error: 'מודעה לדוגמה (בדויה) לא יכולה להיות מסומנת כנבדקת בסקר טכני.' };
    }
  }
  return updateListing(id.data, { tech_assessment: value.data });
}

export async function deleteListing(listingId: string): Promise<ActionResult> {
  await requireAdmin();
  const id = idSchema.safeParse(listingId);
  if (!id.success) return BAD_ID;

  const supabase = await createClient();
  // Collect file paths first: the rows that reference them are removed by ON DELETE CASCADE.
  const [images, docs] = await Promise.all([
    supabase.from('listing_images').select('storage_path').eq('listing_id', id.data),
    supabase.from('verification_requests').select('document_path').eq('listing_id', id.data),
  ]);

  const { data, error } = await supabase.from('listings').delete().eq('id', id.data).select('id');
  if (error) return { ok: false, error: hebrewError(error) };
  if (!data?.length) return { ok: false, error: 'המודעה לא נמצאה או שכבר נמחקה.' };

  // Best-effort storage cleanup. Storage RLS decides what an admin may remove;
  // a failure here must not report the (already completed) deletion as failed.
  const imagePaths = ((images.data ?? []) as { storage_path: string }[]).map((r) => r.storage_path);
  const docPaths = ((docs.data ?? []) as { document_path: string }[]).map((r) => r.document_path);
  await Promise.all([
    imagePaths.length ? supabase.storage.from(STORAGE_BUCKETS.listingImages).remove(imagePaths) : null,
    docPaths.length ? supabase.storage.from(STORAGE_BUCKETS.ownershipDocs).remove(docPaths) : null,
  ]).catch((e: unknown) => console.error('[admin] storage cleanup', e));

  revalidateSite();
  return { ok: true };
}
