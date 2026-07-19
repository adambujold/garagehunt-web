import { createClient } from '@/lib/supabase-browser';

// Ported from the mobile app's utils/favorites.ts — a real insert/delete
// here fires the sync_listing_favorite_count trigger (see the mobile
// repo's 0002/0003 favorites migrations), which keeps
// sale_listings.favorite_count in sync server-side. No new backend needed.

export async function isListingFavorited(userId: string, listingId: string): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('favorites')
    .select('user_id')
    .eq('user_id', userId)
    .eq('listing_id', listingId)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

export async function addFavorite(userId: string, listingId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('favorites').insert({ user_id: userId, listing_id: listingId });
  if (error) throw error;
}

export async function removeFavorite(userId: string, listingId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('favorites').delete().eq('user_id', userId).eq('listing_id', listingId);
  if (error) throw error;
}
