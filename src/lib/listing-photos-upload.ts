import { createClient } from '@/lib/supabase-browser';
// moderateListingPhoto is no longer called here — the Edge Function now
// classifies, stores, and records the photo in one operation, so there is no
// verdict for this layer to receive (0042).

// Web port of the mobile app's utils/listing-photos.ts upload path — same
// "transcode HEIC before it ever reaches Storage" fix (see the mobile
// repo's normalizeToJpegIfHeic), just using heic2any + the browser's own
// File/Blob APIs instead of expo-image-manipulator/expo-file-system.

const PHOTO_BUCKET = 'listing-photos';
export const MAX_LISTING_PHOTOS = 10;

// listing_photos.photo_type (mobile repo's 0036_day_of_photos.sql). 'planning'
// is the default for every normal List a Sale upload; 'day_of' is tagged only
// by the day-of add-photos flow (src/app/day-of-photos/[id]).
export type PhotoType = 'planning' | 'day_of';

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

// A listing_photos row already persisted in the DB (has a real id), as
// surfaced back to the day-of add-photos screen so it can show what's already
// there and delete individual ones.
export type UploadedPhoto = { id: string; storageKey: string; url: string; moderationStatus: string };

// The client's job is now just "hand over the bytes". moderate-listing-photo
// classifies, stores, and records the photo in one server-side operation — see
// the mobile repo's 0042_server_side_photo_moderation.sql. This code used to
// receive a verdict and write the listing_photos row itself, which meant it
// could ignore the verdict and insert 'approved'. Clients no longer hold
// INSERT on listing_photos or on the bucket.
export async function uploadListingPhoto(
  listingId: string,
  photo: PendingPhoto,
  sortOrder: number,
  photoType: PhotoType = 'planning'
): Promise<UploadedPhoto> {
  const supabase = createClient();

  const arrayBuffer = await photo.blob.arrayBuffer();
  if (arrayBuffer.byteLength < 1000) {
    throw new Error('That photo could not be read. Please try again.');
  }
  const imageBase64 = await arrayBufferToBase64(arrayBuffer);

  const { data, error } = await supabase.functions.invoke('moderate-listing-photo', {
    body: {
      image_base64: imageBase64,
      media_type: photo.contentType,
      listing_id: listingId,
      sort_order: sortOrder,
      photo_type: photoType,
    },
  });

  if (error) {
    // Non-2xx arrives as FunctionsHttpError with our JSON body attached; that
    // message is written for the seller, so prefer it over a generic one.
    const response = (error as { context?: Response }).context;
    let message: string | null = null;
    try {
      const body = await response?.json();
      if (body?.error) message = body.error as string;
    } catch {
      // No JSON body — failed below the function (gateway/network).
    }
    throw new Error(
      message ??
        (response?.status === 404
          ? "Photo upload isn't available right now — the moderate-listing-photo function isn't deployed."
          : 'That photo could not be added. Please try again.')
    );
  }
  if (data?.error) throw new Error(data.error as string);

  const row = data.photo as { id: string; storage_key: string; moderation_status: string };
  return {
    id: row.id,
    storageKey: row.storage_key,
    url: getListingPhotoUrl(row.storage_key),
    moderationStatus: row.moderation_status,
  };
}

// A listing's photos, for the seller's own editing screens. Returns pending
// ones too — the seller should see a photo they just added even while it
// awaits manual review — unlike the public listings query, which is
// approved-only. Pass photoType to scope it: the day-of flow wants only
// 'day_of', Edit Listing wants the original 'planning' set.
export async function fetchListingPhotos(
  listingId: string,
  photoType?: PhotoType,
  order: { column: 'created_at' | 'sort_order'; ascending: boolean } = {
    column: 'created_at',
    ascending: false,
  }
): Promise<UploadedPhoto[]> {
  const supabase = createClient();
  let query = supabase
    .from('listing_photos')
    .select('id, storage_key, moderation_status, created_at, sort_order')
    .eq('listing_id', listingId);
  if (photoType) query = query.eq('photo_type', photoType);
  const { data, error } = await query.order(order.column, { ascending: order.ascending });

  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    storageKey: row.storage_key as string,
    url: getListingPhotoUrl(row.storage_key as string),
    moderationStatus: row.moderation_status as string,
  }));
}

export async function deleteListingPhoto(photoId: string, storageKey: string): Promise<void> {
  const supabase = createClient();
  // Storage object first, then the row — an orphaned row pointing at a
  // deleted object would render broken; the reverse (orphaned object, no row)
  // is harmless. RLS scopes both deletes to the listing's own seller.
  const { error: storageError } = await supabase.storage.from(PHOTO_BUCKET).remove([storageKey]);
  if (storageError) throw storageError;
  const { error: deleteError } = await supabase.from('listing_photos').delete().eq('id', photoId);
  if (deleteError) throw deleteError;
}

export async function uploadPendingPhotos(listingId: string, photos: PendingPhoto[]): Promise<void> {
  for (let i = 0; i < photos.length; i++) {
    await uploadListingPhoto(listingId, photos[i], i);
  }
}
