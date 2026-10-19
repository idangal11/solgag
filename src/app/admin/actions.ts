'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { z } from 'zod';
import type { ActionResult } from '@/components/admin/types';
import { STORAGE_BUCKETS } from '@/lib/config';
import { getMyProfile } from '@/lib/data/queries';
import { notifyVerificationDecision } from '@/lib/notify';
import { createClient } from '@/lib/supabase/server';
import type { ListingStatus } from '@/lib/types';

// Admin mutations. Each one re-checks the admin flag server-side; RLS, the
// listings_guard trigger and the review_verification RPC enforce it again in
// the database. They run under the admin's own session — never the service role.

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Failure = Extract<ActionResult, { ok: false }>;

const SIGNED_URL_SECONDS = 10 * 60;

const idSchema = z.uuid();
const techSchema = z.enum(['not_assessed', 'owner_reported', 'survey_planned', 'assessed']);
const reviewSchema = z.object({
  requestId: z.uuid(),
  approve: z.boolean(),
  note: z.string().trim().max(1000, 'הערת הבודק ארוכה מדי (עד 1000 תווים)'),
});

const BAD_ID: Failure = { ok: false, error: 'מזהה לא תקין' };
const NOT_SIGNED_IN: Failure = { ok: false, error: 'פג תוקף ההתחברות. נא להתחבר מחדש.' };
const NOT_ADMIN: Failure = { ok: false, error: 'אין לך הרשאת ניהול לפעולה זו.' };
const HEBREW = /[֐-׿]/;

/**
 * Server Actions return a result instead of calling notFound(): a thrown 404
 * would reach the client as a rejected promise and only a generic error.
 */
async function adminGate(): Promise<Failure | null> {
  try {
    const profile = await getMyProfile();
    if (!profile) return NOT_SIGNED_IN;
    return profile.isAdmin ? null : NOT_ADMIN;
  } catch (e) {
    console.error('[admin] profile lookup', e);
    return { ok: false, error: 'לא הצלחנו לאמת את הרשאת הניהול. נסו שוב בעוד רגע.' };
  }
}

/** Hebrew text for a database error. Domain triggers and RPCs raise Hebrew messages, which are shown as is. */
function hebrewError(error: { message: string; code?: string }, fallback = 'הפעולה נכשלה. נסו שוב בעוד רגע.'): string {
  if (error.code === '42501') return 'אין לך הרשאה לבצע פעולה זו.';
  if (HEBREW.test(error.message)) return error.message;
  console.error('[admin]', error);
  return fallback;
}

/** Verification badges and listing visibility show up across the whole site. */
function revalidateSite() {
  revalidatePath('/', 'layout');
}

/** Short-lived link to an ownership document. The path is looked up here, never taken from the client. */
export async function getVerificationDocumentUrl(requestId: string): Promise<ActionResult<{ url: string }>> {
  const denied = await adminGate();
  if (denied) return denied;
  const id = idSchema.safeParse(requestId);
  if (!id.success) return BAD_ID;

  const supabase = await createClient();
  const { data, error } = await supabase.from('verification_requests').select('document_path').eq('id', id.data).maybeSingle();
  if (error) return { ok: false, error: hebrewError(error) };
  if (!data) return { ok: false, error: 'הבקשה לא נמצאה. ייתכן שהמודעה נמחקה.', stale: true };

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
  const denied = await adminGate();
  if (denied) return denied;
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'קלט לא תקין' };
  const { requestId, approve, note } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc('review_verification', {
    p_request: requestId,
    p_approve: approve,
    p_note: note || null,
  });
  if (error) {
    // P0002: already decided, or auto-cancelled because the owner changed the listing.
    if (error.code === 'P0002') {
      return { ok: false, error: 'הבקשה כבר טופלה או בוטלה (למשל כי פרטי המודעה שונו). הרשימה עודכנה.', stale: true };
    }
    // 22023: the listing changed since the document was submitted — review_verification's
    // own Hebrew message explains it, so it is shown to the admin unchanged.
    return { ok: false, error: hebrewError(error), stale: error.code === '22023' };
  }
  // Email the owner after the response is sent (no-op when email is not configured).
  after(() => notifyVerificationDecision({ requestId }));
  revalidateSite();
  return { ok: true };
}

type ListingPatch = { admin_hidden: boolean } | { tech_assessment: string };

async function updateListing(listingId: string, patch: ListingPatch): Promise<ActionResult<{ ownerStatus: ListingStatus }>> {
  const supabase = await createClient();
  // .select() makes a row filtered out by RLS (or already deleted) visible as "0 rows" instead of silent success.
  const { data, error } = await supabase.from('listings').update(patch).eq('id', listingId).select('status');
  if (error) return { ok: false, error: hebrewError(error) };
  const row = (data as { status: ListingStatus }[] | null)?.[0];
  if (!row) return { ok: false, error: 'המודעה לא נמצאה. ייתכן שנמחקה.', stale: true };
  revalidateSite();
  return { ok: true, ownerStatus: row.status };
}

/**
 * Staff moderation. Sets listings.admin_hidden, which the owner cannot change
 * (listings_guard) and which keeps the listing out of public reads and blocks
 * new inquiries (RLS). The owner's own status is left untouched, so restoring
 * returns the listing to whatever the owner chose.
 */
export async function setListingAdminHidden(listingId: string, hidden: boolean): Promise<ActionResult<{ ownerStatus: ListingStatus }>> {
  const denied = await adminGate();
  if (denied) return denied;
  const id = idSchema.safeParse(listingId);
  if (!id.success || typeof hidden !== 'boolean') return BAD_ID;
  return updateListing(id.data, { admin_hidden: hidden });
}

/** All four values are open to admins; 'assessed' must follow an actual technical survey (the UI says so and confirms). */
export async function setListingTechAssessment(listingId: string, techAssessment: string): Promise<ActionResult> {
  const denied = await adminGate();
  if (denied) return denied;
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

// ─── Listing deletion + storage cleanup ─────────────────────────────────

const LIST_PAGE = 100;
const MAX_LIST_PAGES = 20;
const MAX_FOLDER_DEPTH = 3;
const REMOVE_BATCH = 100;

/** Every object name under `folder` (recursing into legacy sub-folders), or null when listing failed. */
async function listFolder(supabase: Supabase, bucket: string, folder: string, depth = 0): Promise<string[] | null> {
  const names: string[] = [];
  for (let page = 0; page < MAX_LIST_PAGES; page++) {
    const { data, error } = await supabase.storage.from(bucket).list(folder, { limit: LIST_PAGE, offset: page * LIST_PAGE });
    if (error) {
      console.error('[admin] storage list', bucket, folder, error.message);
      return null;
    }
    for (const entry of data) {
      const path = `${folder}/${entry.name}`;
      if (entry.id) {
        names.push(path);
      } else if (depth < MAX_FOLDER_DEPTH) {
        // A folder prefix (only possible for uploads made before the strict path rule).
        const nested = await listFolder(supabase, bucket, path, depth + 1);
        if (!nested) return null;
        names.push(...nested);
      }
    }
    if (data.length < LIST_PAGE) return names;
  }
  return names;
}

/**
 * Removes `paths` from `bucket` and returns how many objects were left behind.
 * remove() reports "allowed but nothing deleted" as success with a shorter
 * result array, so the deleted names are compared with the request. A path
 * that was not deleted counts only when it is known to exist (`existing`, from
 * the folder listing); DB-referenced paths missing from storage do not.
 */
async function removeFiles(supabase: Supabase, bucket: string, paths: string[], existing: Set<string> | null): Promise<number> {
  let left = 0;
  for (let i = 0; i < paths.length; i += REMOVE_BATCH) {
    const batch = paths.slice(i, i + REMOVE_BATCH);
    const { data, error } = await supabase.storage.from(bucket).remove(batch);
    if (error) {
      console.error('[admin] storage remove', bucket, error.message);
      left += existing ? batch.filter((p) => existing.has(p)).length : batch.length;
      continue;
    }
    const removed = new Set(data.map((o) => o.name));
    const behind = batch.filter((p) => !removed.has(p) && existing?.has(p));
    if (behind.length) console.error('[admin] storage remove left objects behind', bucket, behind);
    left += behind.length;
  }
  return left;
}

/** Files of one bucket: the paths the DB referenced plus everything in the listing's folder. */
async function cleanupBucket(supabase: Supabase, bucket: string, folder: string | null, referenced: string[]): Promise<number> {
  // Listings without an owner (sample data) have no folder; only their referenced paths are tried.
  const listed = folder ? await listFolder(supabase, bucket, folder) : null;
  const paths = [...new Set([...referenced, ...(listed ?? [])])];
  const left = paths.length ? await removeFiles(supabase, bucket, paths, listed ? new Set(listed) : null) : 0;
  // A failed listing means files may remain that were never even attempted.
  return folder && !listed ? Math.max(left, 1) : left;
}

/**
 * Permanently deletes a listing (images rows, inquiries, messages and
 * verification requests cascade in the DB), then removes its photos from
 * listing-images and its ownership documents from ownership-docs. Files live
 * at <owner uid>/<listing id>/<file> in both buckets; admins have SELECT and
 * DELETE on both, which storage remove() needs.
 */
export async function deleteListing(listingId: string): Promise<ActionResult<{ warning?: string }>> {
  const denied = await adminGate();
  if (denied) return denied;
  const id = idSchema.safeParse(listingId);
  if (!id.success) return BAD_ID;

  const supabase = await createClient();
  const { data: listing, error: lookupError } = await supabase.from('listings').select('owner_id').eq('id', id.data).maybeSingle();
  if (lookupError) return { ok: false, error: hebrewError(lookupError) };
  if (!listing) return { ok: false, error: 'המודעה לא נמצאה או שכבר נמחקה.', stale: true };
  const ownerId = (listing as { owner_id: string | null }).owner_id;
  const folder = ownerId ? `${ownerId}/${id.data}` : null;

  // Collect referenced paths first: the rows that hold them are removed by ON DELETE CASCADE.
  const [images, docs] = await Promise.all([
    supabase.from('listing_images').select('storage_path').eq('listing_id', id.data),
    supabase.from('verification_requests').select('document_path').eq('listing_id', id.data),
  ]);
  if (images.error) console.error('[admin] listing_images lookup', images.error);
  if (docs.error) console.error('[admin] verification_requests lookup', docs.error);
  const imagePaths = ((images.data ?? []) as { storage_path: string }[]).map((r) => r.storage_path);
  const docPaths = ((docs.data ?? []) as { document_path: string }[]).map((r) => r.document_path);

  const { data, error } = await supabase.from('listings').delete().eq('id', id.data).select('id');
  if (error) return { ok: false, error: hebrewError(error) };
  if (!data?.length) return { ok: false, error: 'המודעה לא נמצאה או שכבר נמחקה.', stale: true };
  revalidateSite();

  // The folders are listed only now: with the listing gone, the upload policy
  // (which requires an owned listing) cannot add files behind our back.
  // A cleanup failure must not report the (already completed) deletion as failed.
  let left: number;
  try {
    const counts = await Promise.all([
      cleanupBucket(supabase, STORAGE_BUCKETS.listingImages, folder, imagePaths),
      cleanupBucket(supabase, STORAGE_BUCKETS.ownershipDocs, folder, docPaths),
    ]);
    left = counts[0] + counts[1];
  } catch (e) {
    console.error('[admin] storage cleanup', e);
    left = 1;
  }
  if (!left) return { ok: true };

  console.error('[admin] deleteListing: storage cleanup incomplete', id.data, folder);
  // U+2066/U+2069 isolate the left-to-right path inside the Hebrew sentence.
  const where = folder ? ` (התיקייה ⁦${folder}⁩ בשני הדליים)` : '';
  return {
    ok: true,
    warning: `המודעה נמחקה, אך חלק מהתמונות או ממסמכי הבעלות שלה לא הוסרו מהאחסון. יש להסיר אותם ידנית ב-Supabase Storage${where}.`,
  };
}
