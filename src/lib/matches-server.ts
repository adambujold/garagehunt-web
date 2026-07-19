import { LISTING_SELECT, mapRow, type Listing, type ListingRow } from '@/lib/listings';
import { createClient } from '@/lib/supabase-server';

// Server-Component read path for "your matches" — mirrors the mobile app's
// utils/fetch-matches.ts, just via the server client (authenticated read,
// scoped by the matches RLS policy to this user's own saved search).

export type MatchedListing = { listing: Listing; matchedAt: string; isNew: boolean };

const NEW_MATCH_WINDOW_MS = 24 * 60 * 60 * 1000;

type DbMatchRow = { matched_at: string; sale_listings: ListingRow | null };

export async function getMatchesForSavedSearch(savedSearchId: string): Promise<MatchedListing[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('matches')
    .select(`matched_at, sale_listings(${LISTING_SELECT})`)
    .eq('saved_search_id', savedSearchId)
    .order('matched_at', { ascending: false });

  if (error) throw error;

  const now = Date.now();
  return ((data ?? []) as unknown as DbMatchRow[])
    .filter((row): row is DbMatchRow & { sale_listings: ListingRow } => row.sale_listings !== null)
    .map((row) => ({
      listing: mapRow(row.sale_listings),
      matchedAt: row.matched_at,
      isNew: now - new Date(row.matched_at).getTime() < NEW_MATCH_WINDOW_MS,
    }));
}
