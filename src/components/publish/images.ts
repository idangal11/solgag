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

/**
 * Uploads pending photos in order and records them in listing_images.
 * Returns how many failed; a failure never rolls back the listing itself.
 */
export async function uploadListingImages(
  supabase: SupabaseClient,
  { userId, listingId, images, firstSortOrder }: { userId: string; listingId: string; images: PendingImage[]; firstSortOrder: number },
): Promise<number> {
  let failed = 0;
  for (let i = 0; i < images.length; i++) {
    const sortOrder = Math.min(50, firstSortOrder + i);
    const path = `${userId}/${listingId}/${sortOrder}-${crypto.randomUUID()}.jpg`;
    const bucket = supabase.storage.from(STORAGE_BUCKETS.listingImages);
    const { error: uploadError } = await bucket.upload(path, images[i].blob, {
      contentType: 'image/jpeg',
      cacheControl: '31536000',
      upsert: false,
    });
    if (uploadError) {
      failed++;
      continue;
    }
    const { error: rowError } = await supabase
      .from('listing_images')
      .insert({ listing_id: listingId, storage_path: path, sort_order: sortOrder });
    if (rowError) {
      failed++;
      await bucket.remove([path]);
    }
  }
  return failed;
}

/**
 * Deletes listing_images rows, then their files (the bucket is public, so the
 * file itself must go too). Returns how many photos were not fully removed.
 */
export async function removeListingImages(supabase: SupabaseClient, images: ExistingImage[]): Promise<number> {
  if (!images.length) return 0;
  const { data, error } = await supabase
    .from('listing_images')
    .delete()
    .in(
      'id',
      images.map((i) => i.id),
    )
    .select('id');
  if (error) return images.length;
  const deleted = new Set((data ?? []).map((r: { id: string }) => r.id));
  const paths = images.filter((i) => deleted.has(i.id)).map((i) => i.path);
  let removedFiles = 0;
  if (paths.length) {
    const { data: files, error: storageError } = await supabase.storage.from(STORAGE_BUCKETS.listingImages).remove(paths);
    removedFiles = storageError ? 0 : (files?.length ?? 0);
  }
  return images.length - Math.min(deleted.size, removedFiles);
}
