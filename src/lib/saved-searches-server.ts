import { createClient } from '@/lib/supabase-server';
import type { SavedSearch } from '@/lib/saved-searches';

// Server-Component read path for the /saved-searches page's initial
// render — mirrors src/lib/saved-searches.ts's fetchMySavedSearch, just via
// the server client.

type DbSavedSearchRow = {
  id: string;
  keywords: string[] | null;
  category_ids: string[] | null;
  center_latitude: number;
  center_longitude: number;
  radius_km: number;
  date_from: string | null;
  date_to: string | null;
  notify_enabled: boolean;
};

export async function getMySavedSearch(userId: string): Promise<SavedSearch | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('saved_searches')
    .select('id, keywords, category_ids, center_latitude, center_longitude, radius_km, date_from, date_to, notify_enabled')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as DbSavedSearchRow;
  let categoryNames: string[] = [];
  if (row.category_ids && row.category_ids.length > 0) {
    const { data: categoryRows, error: categoryError } = await supabase
      .from('categories')
      .select('name')
      .in('id', row.category_ids);
    if (categoryError) throw categoryError;
    categoryNames = (categoryRows ?? []).map((c) => c.name);
  }

  return {
    id: row.id,
    keywords: row.keywords ?? [],
    categoryNames,
    centerLatitude: row.center_latitude,
    centerLongitude: row.center_longitude,
    radiusKm: row.radius_km,
    dateFrom: row.date_from,
    dateTo: row.date_to,
    notifyEnabled: row.notify_enabled,
  };
}
