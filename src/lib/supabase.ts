import { createClient } from '@supabase/supabase-js';

// Server-side client for Phase 1 (public, no-login browsing) — anon key
// only, same as the mobile app's client-safe key. Every read goes through
// the `sale_listings` view (see mobile repo's migration
// 0034_address_privacy_enforcement.sql), which already fuzzes
// unrevealed exact locations/addresses at the database level — this
// client never needs to know about that, it just gets back whatever the
// view decides is safe to show an anonymous reader.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const PHOTO_BUCKET = 'listing-photos';

export function getListingPhotoUrl(storageKey: string): string {
  return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(storageKey).data.publicUrl;
}
