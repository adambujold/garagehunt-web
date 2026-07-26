import { getListingPhotoUrl, supabase } from '@/lib/supabase';
import { deriveHotTier, type HotTier } from '@/lib/brand';
import { deriveTitle } from '@/lib/format';

// Selects through the `sale_listings` view (see the mobile repo's
// 0034_address_privacy_enforcement.sql) — address_text/latitude/longitude
// come back already fuzzed for any listing that isn't revealed yet, since
// this client only ever holds the anon key. Nothing here needs to know
// about reveal_at itself; the view already decided what's safe to return.
export const LISTING_SELECT = `
  id, title, description, address_text, latitude, longitude, is_revealed,
  start_date, end_date, daily_start_time, daily_end_time, status,
  other_items, favorite_count, event_id, is_boosted, payment_method,
  created_at,
  listing_categories(categories(name)),
  listing_photos(storage_key, sort_order, moderation_status, photo_type, created_at)
`;

export type ListingRow = {
  id: string;
  title: string | null;
  description: string | null;
  address_text: string;
  latitude: number;
  longitude: number;
  is_revealed: boolean;
  start_date: string;
  end_date: string;
  daily_start_time: string;
  daily_end_time: string;
  status: string;
  other_items: string[];
  favorite_count: number;
  event_id: string | null;
  is_boosted: boolean;
  payment_method: 'cash_only' | 'cash_and_etransfer';
  created_at: string;
  listing_categories: { categories: { name: string } | null }[] | null;
  listing_photos: DisplayPhotoRow[] | null;
};

// A listing_photos row as embedded in a listing query — only the fields that
// decide display order and eligibility. Exported so the seller dashboard
// (lib/my-listings.ts) can reuse the same shape and derivation.
export type DisplayPhotoRow = {
  storage_key: string;
  sort_order: number;
  moderation_status: string;
  photo_type: string;
  created_at: string;
};

export type Listing = {
  id: string;
  title: string;
  description: string;
  addressLabel: string;
  isRevealed: boolean;
  latitude: number;
  longitude: number;
  startDate: string;
  endDate: string;
  dailyStartTime: string;
  dailyEndTime: string;
  categories: string[];
  otherItems: string[];
  favoriteCount: number;
  hotTier: HotTier;
  eventId: string | null;
  isBoosted: boolean;
  paymentMethod: 'cash_only' | 'cash_and_etransfer';
  photoUrls: string[];
  // True when an approved day_of photo exists from *today* — drives the
  // "📸 Fresh Photos" badge (feature spec 4f). Derived at render time in
  // mapRow, never stored; re-derived on every fetch so it resets each day.
  hasFreshPhotoToday: boolean;
  createdAt: string;
};

// Which Toronto calendar day a timestamp falls on, as 'YYYY-MM-DD'. Anchored
// to America/Toronto (not the SSR server's UTC) so the website's notion of
// "today" matches the cron job that sends the reminder (mobile repo's
// 0037_day_of_photo_reminders_cron.sql, same timezone) and the London launch
// market. en-CA formats as YYYY-MM-DD.
function torontoDay(date: Date): string {
  return date.toLocaleString('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

// Day-of Photos display rule (feature spec 4f / tech arch Section 10), derived
// at render time — no stored "primary photo" flag. From the approved photos
// (only ever those on this public, crawlable page), any day_of photo added
// *today* leads the gallery/thumbnail (most recent first); everything else
// (planning photos, plus day_of photos from earlier days of a multi-day sale)
// follows in sort_order. With no day_of photo from today this is exactly the
// old behavior: all approved photos in sort_order.
export function deriveDisplayPhotos(
  photos: DisplayPhotoRow[] | null,
  now: Date
): { photoUrls: string[]; hasFreshPhotoToday: boolean } {
  const approved = (photos ?? []).filter((p) => p.moderation_status === 'approved');
  const todayStr = torontoDay(now);
  const freshToday = approved
    .filter((p) => p.photo_type === 'day_of' && torontoDay(new Date(p.created_at)) === todayStr)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const freshKeys = new Set(freshToday.map((p) => p.storage_key));
  const rest = approved.filter((p) => !freshKeys.has(p.storage_key)).sort((a, b) => a.sort_order - b.sort_order);

  return {
    photoUrls: [...freshToday, ...rest].map((p) => getListingPhotoUrl(p.storage_key)),
    hasFreshPhotoToday: freshToday.length > 0,
  };
}

export function mapRow(row: ListingRow): Listing {
  const categories = (row.listing_categories ?? [])
    .map((entry) => entry.categories?.name)
    .filter((name): name is string => Boolean(name));

  // Only ever show photos a human/AI pass has actually cleared — a photo
  // still `pending` review has no business being indexed on a public,
  // crawlable page before a person has looked at it. deriveDisplayPhotos
  // applies that approved-only filter and then leads with today's day_of
  // photos (feature spec 4f).
  const { photoUrls, hasFreshPhotoToday } = deriveDisplayPhotos(row.listing_photos, new Date());

  return {
    id: row.id,
    title: row.title ?? deriveTitle(row.address_text),
    description: row.description ?? '',
    addressLabel: row.address_text,
    isRevealed: row.is_revealed,
    latitude: row.latitude,
    longitude: row.longitude,
    startDate: row.start_date,
    endDate: row.end_date,
    dailyStartTime: row.daily_start_time,
    dailyEndTime: row.daily_end_time,
    categories,
    otherItems: row.other_items,
    favoriteCount: row.favorite_count,
    hotTier: deriveHotTier(row.favorite_count),
    eventId: row.event_id,
    isBoosted: row.is_boosted,
    paymentMethod: row.payment_method,
    photoUrls,
    hasFreshPhotoToday,
    createdAt: row.created_at,
  };
}

// Browse page — every published listing (the view already filters out
// draft/cancelled/rejected rows for an anon reader), boosted listings
// first, then newest first.
export async function getPublishedListings(): Promise<Listing[]> {
  const { data, error } = await supabase
    .from('sale_listings')
    .select(LISTING_SELECT)
    .eq('status', 'published')
    .order('is_boosted', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as unknown as ListingRow[]).map(mapRow);
}

export async function getListingById(id: string): Promise<Listing | null> {
  const { data, error } = await supabase
    .from('sale_listings')
    .select(LISTING_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapRow(data as unknown as ListingRow);
}

// /favorites — a buyer's favorited listings, in whatever order the caller
// asks for by re-sorting the result (favorites-server.ts returns ids most-
// recently-favorited first; this just needs to fetch the matching rows).
export async function getListingsByIds(ids: string[]): Promise<Listing[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('sale_listings').select(LISTING_SELECT).in('id', ids);

  if (error) throw error;
  return (data as unknown as ListingRow[]).map(mapRow);
}

// Sitemap needs every public listing id without the rest of the payload.
export async function getAllPublishedListingIds(): Promise<{ id: string; updatedAt: string }[]> {
  const { data, error } = await supabase
    .from('sale_listings')
    .select('id, updated_at')
    .eq('status', 'published');

  if (error) throw error;
  return (data ?? []).map((row) => ({ id: row.id as string, updatedAt: row.updated_at as string }));
}

export type TownWideEvent = {
  id: string;
  name: string;
  centerLatitude: number;
  centerLongitude: number;
  radiusKm: number;
  startDate: string;
  endDate: string;
};

export async function getEventById(id: string): Promise<TownWideEvent | null> {
  const { data, error } = await supabase
    .from('town_wide_events')
    .select('id, name, center_latitude, center_longitude, radius_km, start_date, end_date')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    centerLatitude: data.center_latitude,
    centerLongitude: data.center_longitude,
    radiusKm: data.radius_km,
    startDate: data.start_date,
    endDate: data.end_date,
  };
}

export async function getListingsForEvent(eventId: string): Promise<Listing[]> {
  const { data, error } = await supabase
    .from('sale_listings')
    .select(LISTING_SELECT)
    .eq('status', 'published')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as unknown as ListingRow[]).map(mapRow);
}

export async function getAllEventIds(): Promise<string[]> {
  const { data, error } = await supabase.from('town_wide_events').select('id');
  if (error) throw error;
  return (data ?? []).map((row) => row.id as string);
}
