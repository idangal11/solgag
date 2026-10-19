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

// Not exported: a 'use server' module may only export async functions.
const ADMIN_HIDDEN_ERROR = 'המודעה הוסתרה על ידי צוות האתר, ולכן לא ניתן לשנות את מצב הפרסום שלה. לבירור אפשר לפנות לצוות האתר.';

/** Hide a listing from search/map (and new inquiries), or publish it again. */
export async function setListingStatus(listingId: string, status: ListingStatus): Promise<ActionResult> {
  if (!idSchema.safeParse(listingId).success || !statusSchema.safeParse(status).success) return fail('בקשה לא תקינה');
  const s = await session();
  if (!s) return fail(NOT_SIGNED_IN);
  // A listing hidden by staff (admin_hidden) stays hidden whatever its status, so
  // do not touch it at all — otherwise "published again" would be a false claim.
  const { data, error } = await s.supabase
    .from('listings')
    .update({ status })
    .eq('id', listingId)
    .eq('owner_id', s.user.id)
    .eq('admin_hidden', false)
    .select('id');
  if (error) {
    console.error('setListingStatus', error);
    return fail(dbErrorMessage(error, 'לא הצלחנו לעדכן את סטטוס המודעה. נסו שוב.'));
  }
  if (!data?.length) {
    const { data: row } = await s.supabase
      .from('listings')
      .select('admin_hidden')
      .eq('id', listingId)
      .eq('owner_id', s.user.id)
      .maybeSingle();
    if (row?.admin_hidden) {
      revalidatePath('/dashboard');
      return fail(ADMIN_HIDDEN_ERROR);
    }
    return fail('המודעה לא נמצאה או שאין לך הרשאה לעדכן אותה.');
  }
  revalidateListing(listingId);
  return { ok: true };
}

/** Every object in one storage folder (paged; folders are capped at a few files, older ones may hold more). */
async function listFolder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bucket: string,
  folder: string,
): Promise<string[]> {
  const PAGE = 100;
  const out: string[] = [];
  for (let offset = 0; offset < 1000; offset += PAGE) {
    const { data, error } = await supabase.storage.from(bucket).list(folder, { limit: PAGE, offset });
    if (error) {
      console.warn('deleteListing: list failed', bucket, folder, error.message);
      break;
    }
    // Entries without an id are sub-folders; uploads never create those.
    for (const f of data ?? []) if (f.id && f.name) out.push(`${folder}/${f.name}`);
    if (!data || data.length < PAGE) break;
  }
  return out;
}

/** Removes objects and logs when storage silently skipped some (RLS filters rows instead of failing). */
async function removeObjects(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bucket: string,
  paths: string[],
  listingId: string,
): Promise<void> {
  if (!paths.length) return;
  const { data, error } = await supabase.storage.from(bucket).remove(paths);
  if (error) {
    console.warn('deleteListing: storage cleanup failed', bucket, listingId, error.message);
  } else if ((data?.length ?? 0) < paths.length) {
    console.warn('deleteListing: storage cleanup removed fewer objects than requested', bucket, listingId, {
      requested: paths.length,
      removed: data?.length ?? 0,
    });
  }
}

/**
 * Deletes a listing (images rows, inquiries, messages and verification requests
 * cascade in the DB), then removes its photos and ownership documents from
 * storage. Every upload lives at `<uid>/<listing id>/<file>` (enforced by the
 * storage policies), so that folder is the whole cleanup scope. Storage cleanup
 * failures are logged but do not fail the action — the listing is already gone.
 */
export async function deleteListing(listingId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(listingId).success) return fail('בקשה לא תקינה');
  const s = await session();
  if (!s) return fail(NOT_SIGNED_IN);
  const { supabase, user } = s;
  // Storage names are case-sensitive and uploads use the DB's lowercase uuid text,
  // while the uuid comparisons in the queries below are not.
  const folder = `${user.id}/${listingId.toLowerCase()}`;

  // Collect the paths before the rows cascade away. Owners can list their own
  // folders in both buckets ("listing-images: users read own files",
  // "ownership-docs: owner or admin reads").
  const [{ data: imageRows }, files, docs] = await Promise.all([
    supabase.from('listing_images').select('storage_path').eq('listing_id', listingId),
    listFolder(supabase, STORAGE_BUCKETS.listingImages, folder),
    listFolder(supabase, STORAGE_BUCKETS.ownershipDocs, folder),
  ]);
  const paths = new Set<string>(files);
  for (const r of (imageRows ?? []) as { storage_path: string }[]) {
    // Only this listing's own folder: never a file another listing might use.
    if (r.storage_path.startsWith(`${folder}/`)) paths.add(r.storage_path);
  }

  const { data, error } = await supabase.from('listings').delete().eq('id', listingId).eq('owner_id', user.id).select('id');
  if (error) {
    console.error('deleteListing', error);
    return fail(dbErrorMessage(error, 'לא הצלחנו למחוק את המודעה. נסו שוב.'));
  }
  if (!data?.length) return fail('המודעה לא נמצאה או שאין לך הרשאה למחוק אותה.');

  // Ownership documents become removable by their owner once the cascade has
  // dropped the verification_requests rows that referenced them
  // ("ownership-docs: users delete own unreferenced files").
  await Promise.all([
    removeObjects(supabase, STORAGE_BUCKETS.listingImages, [...paths], listingId),
    removeObjects(supabase, STORAGE_BUCKETS.ownershipDocs, docs, listingId),
  ]);

  revalidateListing(listingId);
  return { ok: true };
}

const verificationSchema = z.object({
  listingId: z.uuid(),
  documentPath: z.string().max(300),
  note: z.string().trim().max(1000, 'ההערה ארוכה מדי (עד 1000 תווים)'),
});

// <uuid>.<ext> — a subset of the storage / verification_requests rule
// (^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$, no "..") that VerificationBox uploads to.
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

  // Same rule as the storage upload policy and the verification_requests insert
  // policy: "<uid>/<listing id as lowercase uuid text>/<uuid>.<ext>".
  const prefix = `${s.user.id}/${listingId.toLowerCase()}/`;
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
