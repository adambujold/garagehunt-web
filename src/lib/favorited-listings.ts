import { getListingsByIds, type Listing } from '@/lib/listings';
import { createClient } from '@/lib/supabase-browser';

// New — mobile's route planner doesn't have an equivalent to port from
// (its Manual Pick mode is still hardcoded to mock data; see the mobile
// repo's app/route-planner.tsx header comment). This is the real thing:
// this user's actual favorited listings, most recently favorited first.
export async function getFavoritedListings(userId: string): Promise<Listing[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('favorites')
    .select('listing_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const ids = (data ?? []).map((row) => row.listing_id as string);
  const listings = await getListingsByIds(ids);

  const order = new Map(ids.map((id, i) => [id, i]));
  return [...listings].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}
