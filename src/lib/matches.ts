import { createClient } from '@/lib/supabase-browser';

// Ported from the mobile app's utils/discover-filters.ts (matchesOtherKeyword)
// and utils/matches.ts (backfillMatchesForSavedSearch) — same case-
// insensitive substring semantics, same backfill-on-save behavior so a
// freshly saved/edited search immediately picks up listings that were
// already published before it existed, not just future ones.

function matchesOtherKeyword(listing: { description: string; otherItems: string[] }, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  if (listing.description.toLowerCase().includes(needle)) return true;
  return listing.otherItems.some((item) => item.toLowerCase().includes(needle));
}

type CandidateListing = {
  id: string;
  description: string | null;
  other_items: string[] | null;
  category_ids: string[] | null;
};

export async function backfillMatchesForSavedSearch(input: {
  searchId: string;
  keywords: string[];
  categoryIds: string[];
}): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('candidate_listings_for_saved_search', {
    p_search_id: input.searchId,
  });
  if (error) throw error;

  const candidates = (data ?? []) as CandidateListing[];
  const matchedListingIds = candidates
    .filter((listing) => {
      const categoryIds = listing.category_ids ?? [];
      const categoryOverlap = categoryIds.some((id) => input.categoryIds.includes(id));
      const keywordOverlap = input.keywords.some((keyword) =>
        matchesOtherKeyword({ description: listing.description ?? '', otherItems: listing.other_items ?? [] }, keyword)
      );
      return categoryOverlap || keywordOverlap;
    })
    .map((listing) => listing.id);

  if (matchedListingIds.length === 0) return;

  const { data: existing, error: existingError } = await supabase
    .from('matches')
    .select('listing_id')
    .eq('saved_search_id', input.searchId)
    .in('listing_id', matchedListingIds);
  if (existingError) throw existingError;

  const alreadyMatchedIds = new Set((existing ?? []).map((row) => row.listing_id));
  const newListingIds = matchedListingIds.filter((id) => !alreadyMatchedIds.has(id));
  if (newListingIds.length === 0) return;

  const { error: insertError } = await supabase
    .from('matches')
    .insert(newListingIds.map((listingId) => ({ saved_search_id: input.searchId, listing_id: listingId, is_backfill: true })));
  if (insertError) throw insertError;
}
