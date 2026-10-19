'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import { STORAGE_BUCKETS } from '@/lib/config';

export const MAX_IMAGES = 8;
const MAX_SIDE = 1600;
const MAX_BYTES = 5 * 1024 * 1024;

/** A photo already stored for the listing (edit mode). */
export interface ExistingImage {
  id: string;
  path: string;
  sortOrder: number;
  url: string;
}

/** A photo picked in this session, compressed and waiting to be uploaded. */
export interface PendingImage {
  key: string;
  blob: Blob;
  previewUrl: string;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('decode'));
    };
    img.src = url;
  });
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', quality),
  );
}

/**
 * Downscales to at most 1600px on the long side and re-encodes as JPEG.
 * Re-encoding also drops EXIF metadata (including GPS position).
 */
export async function compressImage(file: File): Promise<Blob> {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.fillStyle = '#fff'; // transparent PNG areas would otherwise turn black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  for (const q of [0.8, 0.65, 0.5]) {
    const blob = await toJpeg(canvas, q);
    if (blob.size <= MAX_BYTES) return blob;
  }
  throw new Error('too-large');
}

/** Outcome of a batch of photo operations; `reason` explains the first failure in Hebrew. */
export interface ImageResult {
  failed: number;
  reason?: string;
}

type ApiError = { message?: string; statusCode?: string; status?: number; code?: string } | null;

const hasHebrew = (s: string) => /[֐-׿]/.test(s);

/** Storage / PostgREST error → a short Hebrew explanation. */
function imageErrorReason(error: ApiError): string {
  const message = error?.message ?? '';
  const status = String(error?.statusCode ?? error?.status ?? '');
  // Domain errors from the DB triggers (e.g. "up to 8 photos") are already in Hebrew.
  if (hasHebrew(message)) return message;
  if (status === '413' || /maximum allowed size|too large/i.test(message)) return 'הקובץ גדול מהמותר (עד 5MB לתמונה).';
  if (status === '415' || /mime type/i.test(message)) return 'סוג הקובץ אינו נתמך (JPEG, PNG או WebP בלבד).';
  if (status === '403' || error?.code === '42501' || /row-level security|unauthorized/i.test(message)) {
    return 'השרת סירב לשמור את התמונה: ייתכן שהמודעה הגיעה למגבלת הקבצים, או שתוקף ההתחברות פג.';
  }
  return 'בעיית חיבור לשרת התמונות.';
}

/** Storage keys must stay "<uid>/<listing id>/<safe name>" — the only shape the storage policy accepts. */
export function listingImagePath(userId: string, listingId: string, sortOrder: number): string {
  return `${userId}/${listingId}/${sortOrder}-${crypto.randomUUID()}.jpg`;
}

/**
 * Uploads pending photos in order and records them in listing_images.
 * A failure never rolls back the listing itself.
 */
export async function uploadListingImages(
  supabase: SupabaseClient,
  { userId, listingId, images, firstSortOrder }: { userId: string; listingId: string; images: PendingImage[]; firstSortOrder: number },
): Promise<ImageResult> {
  const result: ImageResult = { failed: 0 };
  const fail = (error: ApiError) => {
    result.failed++;
    result.reason ??= imageErrorReason(error);
  };
  const bucket = supabase.storage.from(STORAGE_BUCKETS.listingImages);
  for (let i = 0; i < images.length; i++) {
    const sortOrder = Math.min(50, firstSortOrder + i);
    const path = listingImagePath(userId, listingId, sortOrder);
    const { error: uploadError } = await bucket.upload(path, images[i].blob, {
      contentType: 'image/jpeg',
      cacheControl: '31536000',
      upsert: false,
    });
    if (uploadError) {
      fail(uploadError as ApiError);
      continue;
    }
    const { error: rowError } = await supabase
      .from('listing_images')
      .insert({ listing_id: listingId, storage_path: path, sort_order: sortOrder });
    if (rowError) {
      fail(rowError);
      await bucket.remove([path]);
    }
  }
  return result;
}

/**
 * Deletes listing_images rows, then their files (the bucket is public, so the
 * file itself must go too; owners may read and delete their own folder).
 */
export async function removeListingImages(supabase: SupabaseClient, images: ExistingImage[]): Promise<ImageResult> {
  if (!images.length) return { failed: 0 };
  const { data, error } = await supabase
    .from('listing_images')
    .delete()
    .in(
      'id',
      images.map((i) => i.id),
    )
    .select('id');
  if (error) return { failed: images.length, reason: imageErrorReason(error) };
  const deleted = new Set((data ?? []).map((r: { id: string }) => r.id));
  const paths = images.filter((i) => deleted.has(i.id)).map((i) => i.path);
  let removedFiles = 0;
  let storageError: ApiError = null;
  if (paths.length) {
    const res = await supabase.storage.from(STORAGE_BUCKETS.listingImages).remove(paths);
    storageError = res.error as ApiError;
    removedFiles = res.error ? 0 : (res.data?.length ?? 0);
  }
  const failed = images.length - Math.min(deleted.size, removedFiles);
  if (!failed) return { failed: 0 };
  return {
    failed,
    reason: deleted.size < images.length ? 'לא ניתן היה להסיר את התמונה מהמודעה.' : imageErrorReason(storageError ?? { status: 403 }),
  };
}

/**
 * Removes files in the listing's folder that no listing_images row references
 * (left behind by an interrupted upload). The storage policy caps a folder at
 * 12 files, so orphans would otherwise block new photos. Recent files are kept:
 * another tab may be between its upload and its row insert. Best effort.
 */
export async function pruneOrphanFiles(supabase: SupabaseClient, { userId, listingId }: { userId: string; listingId: string }) {
  const folder = `${userId}/${listingId}`;
  const bucket = supabase.storage.from(STORAGE_BUCKETS.listingImages);
  const [{ data: files, error: listError }, { data: rows, error: rowsError }] = await Promise.all([
    bucket.list(folder, { limit: 100 }),
    supabase.from('listing_images').select('storage_path').eq('listing_id', listingId),
  ]);
  if (listError || rowsError || !files) return;
  const referenced = new Set((rows ?? []).map((r: { storage_path: string }) => r.storage_path));
  const cutoff = Date.now() - 15 * 60 * 1000;
  const orphans = files
    .filter((f) => f.id && f.created_at && !referenced.has(`${folder}/${f.name}`) && Date.parse(f.created_at) < cutoff)
    .map((f) => `${folder}/${f.name}`);
  if (orphans.length) await bucket.remove(orphans);
}
