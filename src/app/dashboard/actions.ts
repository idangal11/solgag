'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { STORAGE_BUCKETS } from '@/lib/config';
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import type { ListingStatus, UserRole } from '@/lib/types';
import { type ActionResult, dbErrorMessage, fail, NOT_SIGNED_IN } from './_lib/actionResult';

// Dashboard mutations. Every write runs with the user's session, so RLS and the
// guard triggers in supabase/migrations are the real authority; the checks here
// only produce friendlier Hebrew errors.

async function session() {
  const user = await getCurrentUser();
  if (!user) return null;
  return { user, supabase: await createClient() };
}

function revalidateListing(id: string) {
  revalidatePath('/dashboard');
  revalidatePath('/');
  revalidatePath(`/listing/${id}`);
}

const roleSchema = z.enum(['owner', 'investor']);
const statusSchema = z.enum(['published', 'hidden']);
const idSchema = z.uuid();

/** Remembers which dashboard tab the user prefers (profiles.role). */
export async function setDashboardRole(role: UserRole): Promise<ActionResult> {
  const parsed = roleSchema.safeParse(role);
  if (!parsed.success) return fail('תפקיד לא תקין');
  const s = await session();
  if (!s) return fail(NOT_SIGNED_IN);
  const { error } = await s.supabase.from('profiles').update({ role: parsed.data }).eq('id', s.user.id);
  if (error) {
    console.error('setDashboardRole', error);
    return fail(dbErrorMessage(error, 'לא הצלחנו לשמור את התצוגה המועדפת.'));
  }
  return { ok: true };
}

/** Hide a listing from search/map (and new inquiries), or publish it again. */
export async function setListingStatus(listingId: string, status: ListingStatus): Promise<ActionResult> {
  if (!idSchema.safeParse(listingId).success || !statusSchema.safeParse(status).success) return fail('בקשה לא תקינה');
  const s = await session();
  if (!s) return fail(NOT_SIGNED_IN);
  const { data, error } = await s.supabase
    .from('listings')
    .update({ status })
    .eq('id', listingId)
    .eq('owner_id', s.user.id)
    .select('id');
  if (error) {
    console.error('setListingStatus', error);
    return fail(dbErrorMessage(error, 'לא הצלחנו לעדכן את סטטוס המודעה. נסו שוב.'));
  }
  if (!data?.length) return fail('המודעה לא נמצאה או שאין לך הרשאה לעדכן אותה.');
  revalidateListing(listingId);
  return { ok: true };
}

/**
 * Deletes a listing (images rows, inquiries, messages and verification requests
 * cascade in the DB), then removes its photos from storage. Storage cleanup
 * failures are logged but do not fail the action — the listing is already gone.
 */
export async function deleteListing(listingId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(listingId).success) return fail('בקשה לא תקינה');
  const s = await session();
  if (!s) return fail(NOT_SIGNED_IN);
  const { supabase, user } = s;
  const folder = `${user.id}/${listingId}`;

  // Collect the photo paths before the rows cascade away.
  const paths = new Set<string>();
  const [{ data: imageRows }, { data: files }, { data: docs }] = await Promise.all([
    supabase.from('listing_images').select('storage_path').eq('listing_id', listingId),
    supabase.storage.from(STORAGE_BUCKETS.listingImages).list(folder, { limit: 100 }),
    supabase.storage.from(STORAGE_BUCKETS.ownershipDocs).list(folder, { limit: 100 }),
  ]);
  for (const r of (imageRows ?? []) as { storage_path: string }[]) {
    if (r.storage_path.startsWith(`${user.id}/`)) paths.add(r.storage_path);
  }
  for (const f of files ?? []) {
    if (f.name && f.id) paths.add(`${folder}/${f.name}`);
  }

  const { data, error } = await supabase.from('listings').delete().eq('id', listingId).eq('owner_id', user.id).select('id');
  if (error) {
    console.error('deleteListing', error);
    return fail(dbErrorMessage(error, 'לא הצלחנו למחוק את המודעה. נסו שוב.'));
  }
  if (!data?.length) return fail('המודעה לא נמצאה או שאין לך הרשאה למחוק אותה.');

  if (paths.size) {
    const { error: storageError } = await supabase.storage.from(STORAGE_BUCKETS.listingImages).remove([...paths]);
    if (storageError) console.warn('deleteListing: storage cleanup failed', listingId, storageError.message);
  }
  // Ownership documents lose their verification_requests rows with the listing.
  // Removing them needs a delete policy on ownership-docs; until then this is a no-op.
  const docPaths = (docs ?? []).filter((f) => f.id).map((f) => `${folder}/${f.name}`);
  if (docPaths.length) {
    const { error: docsError } = await supabase.storage.from(STORAGE_BUCKETS.ownershipDocs).remove(docPaths);
    if (docsError) console.warn('deleteListing: ownership-docs cleanup failed', listingId, docsError.message);
  }

  revalidateListing(listingId);
  return { ok: true };
}

const verificationSchema = z.object({
  listingId: z.uuid(),
  documentPath: z.string().max(300),
  note: z.string().trim().max(1000, 'ההערה ארוכה מדי (עד 1000 תווים)'),
});

const DOC_FILE = /^[0-9a-f-]{36}\.(pdf|jpg|png|webp)$/i;

/**
 * Registers an ownership document that the browser already uploaded to the
 * private ownership-docs bucket at `${uid}/${listingId}/<uuid>.<ext>`.
 * The DB trigger moves the listing to "pending"; only staff can mark it verified.
 */
export async function submitVerificationRequest(input: { listingId: string; documentPath: string; note: string }): Promise<ActionResult> {
  const parsed = verificationSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'בקשה לא תקינה');
  const s = await session();
  if (!s) return fail(NOT_SIGNED_IN);
  const { listingId, documentPath, note } = parsed.data;

  const prefix = `${s.user.id}/${listingId}/`;
  if (!documentPath.startsWith(prefix) || !DOC_FILE.test(documentPath.slice(prefix.length))) {
    return fail('נתיב המסמך אינו תקין.');
  }

  const { data: listing, error: listingError } = await s.supabase
    .from('listings')
    .select('owner_verification')
    .eq('id', listingId)
    .eq('owner_id', s.user.id)
    .maybeSingle();
  if (listingError) {
    console.error('submitVerificationRequest: listing lookup', listingError);
    return fail('לא הצלחנו לשלוח את הבקשה. נסו שוב.');
  }
  if (!listing) return fail('המודעה לא נמצאה או שאינה שלך.');
  if (listing.owner_verification === 'pending') return fail('כבר קיימת בקשת אימות ממתינה למודעה זו.');
  if (listing.owner_verification === 'verified') return fail('הבעלות במודעה זו כבר נבדקה מול מסמכים.');

  const { error } = await s.supabase
    .from('verification_requests')
    .insert({ listing_id: listingId, owner_id: s.user.id, document_path: documentPath, note });
  if (error) {
    console.error('submitVerificationRequest', error);
    return fail(dbErrorMessage(error, 'לא הצלחנו לשלוח את הבקשה לבדיקה. נסו שוב.'));
  }

  revalidateListing(listingId);
  return { ok: true };
}
