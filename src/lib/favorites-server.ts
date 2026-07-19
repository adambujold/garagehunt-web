import { createClient } from '@/lib/supabase-server';

// Server-Component-side favorites reads — src/lib/favorites.ts uses the
// browser client (for the interactive toggle button) and can't run here,
// since createBrowserClient expects document.cookie, not the request
// cookies a Server Component sees.

// Discover: which of the currently-displayed listings has this user
// already favorited — one batched query, not one per card.
export async function getFavoritedListingIdSet(userId: string, listingIds: string[]): Promise<Set<string>> {
  if (listingIds.length === 0) return new Set();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('favorites')
    .select('listing_id')
    .eq('user_id', userId)
    .in('listing_id', listingIds);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.listing_id as string));
}

// /favorites page: every listing id this user has favorited, most
// recently favorited first.
export async function getFavoritedListingIds(userId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('favorites')
    .select('listing_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => row.listing_id as string);
}
