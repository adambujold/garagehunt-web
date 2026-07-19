import { createClient } from '@/lib/supabase-browser';
import { moderateListingPhoto } from '@/lib/moderation';

// Web port of the mobile app's utils/listing-photos.ts upload path — same
// "transcode HEIC before it ever reaches Storage" fix (see the mobile
// repo's normalizeToJpegIfHeic), just using heic2any + the browser's own
// File/Blob APIs instead of expo-image-manipulator/expo-file-system.

const PHOTO_BUCKET = 'listing-photos';
export const MAX_LISTING_PHOTOS = 10;

function isHeic(file: File): boolean {
  const type = file.type.toLowerCase();
  return type === 'image/heic' || type === 'image/heif' || /\.(heic|heif)$/i.test(file.name);
}

// Browsers can't decode/preview HEIC any better than they can render it on
// a public page (the exact bug fixed on the mobile upload path) — converting
// immediately on selection means the picker's own thumbnail grid shows a
// real preview too, not just Storage.
export async function normalizeToJpegIfHeic(file: File): Promise<{ blob: Blob; extension: string; contentType: string }> {
  if (!isHeic(file)) {
    const extension = file.name.match(/\.(\w+)$/)?.[1]?.toLowerCase() ?? 'jpg';
    const contentType = file.type || (extension === 'png' ? 'image/png' : 'image/jpeg');
    return { blob: file, extension, contentType };
  }

  const heic2any = (await import('heic2any')).default;
  const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
  const blob = Array.isArray(converted) ? converted[0] : converted;
  return { blob, extension: 'jpg', contentType: 'image/jpeg' };
}

async function arrayBufferToBase64(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function getListingPhotoUrl(storageKey: string): string {
  const supabase = createClient();
  return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(storageKey).data.publicUrl;
}

export type PendingPhoto = { blob: Blob; extension: string; contentType: string; previewUrl: string };

export async function preparePickedPhoto(file: File): Promise<PendingPhoto> {
  const { blob, extension, contentType } = await normalizeToJpegIfHeic(file);
  return { blob, extension, contentType, previewUrl: URL.createObjectURL(blob) };
}

export async function uploadListingPhoto(listingId: string, photo: PendingPhoto, sortOrder: number): Promise<void> {
  const supabase = createClient();
  const randomName = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}.${photo.extension}`;
  const storageKey = `${listingId}/${randomName}`;

  const arrayBuffer = await photo.blob.arrayBuffer();
  if (arrayBuffer.byteLength < 1000) {
    throw new Error('That photo could not be read. Please try again.');
  }

  const imageBase64 = await arrayBufferToBase64(arrayBuffer);
  const decision = await moderateListingPhoto(imageBase64, photo.contentType);
  if (decision === 'reject') {
    throw new Error("That photo doesn't meet our content guidelines. Please choose a different photo.");
  }

  const { error: uploadError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(storageKey, arrayBuffer, { contentType: photo.contentType });
  if (uploadError) throw uploadError;

  const moderationStatus = decision === 'approve' ? 'approved' : 'pending';
  const { error: insertError } = await supabase
    .from('listing_photos')
    .insert({ listing_id: listingId, storage_key: storageKey, sort_order: sortOrder, moderation_status: moderationStatus });

  if (insertError) {
    await supabase.storage.from(PHOTO_BUCKET).remove([storageKey]).catch(() => {});
    throw insertError;
  }
}

export async function uploadPendingPhotos(listingId: string, photos: PendingPhoto[]): Promise<void> {
  for (let i = 0; i < photos.length; i++) {
    await uploadListingPhoto(listingId, photos[i], i);
  }
}
