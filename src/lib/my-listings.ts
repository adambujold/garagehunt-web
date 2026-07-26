import { deriveDisplayPhotos, type DisplayPhotoRow } from '@/lib/listings';
import { deriveTitle, formatSaleSchedule } from '@/lib/format';
import { createClient } from '@/lib/supabase-server';

// The seller dashboard's read path — the website had no equivalent of the
// app's My Listings screen, so a web seller could publish a sale and then
// never see or edit it again. Server-side reads (Server Components), unlike
// the browser-client writes in sale-listings-write.ts.
//
// Reads go through the public.sale_listings view, whose WHERE clause already
// includes `or seller_id = auth.uid()` — so a seller sees their own drafts
// and cancelled listings here, which the public browse query never returns.

// Display-only, derived from dates at render time and never stored — mirrors
// the app's deriveDisplayStatus (mobile utils/sale-listings.ts).
export type DisplayStatus = 'draft' | 'scheduled' | 'live' | 'ended' | 'cancelled';

export type MyListing = {
  id: string;
  title: string;
  status: DisplayStatus;
  scheduleLabel: string;
  viewCount: number;
  favoriteCount: number;
  checkinCount: number;
  photoUrl: string | null;
  hasFreshPhotoToday: boolean;
  isBoosted: boolean;
  /** Whether the day-of "add photos" flow applies right now (live sale only). */
  isLiveToday: boolean;
};

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function deriveDisplayStatus(
  status: string,
  startDate: string,
  endDate: string,
  now: Date = new Date()
): DisplayStatus {
  if (status === 'draft') return 'draft';
  if (status === 'cancelled') return 'cancelled';
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (today < parseIsoDate(startDate)) return 'scheduled';
  if (today > parseIsoDate(endDate)) return 'ended';
  return 'live';
}

export const STATUS_LABELS: Record<DisplayStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  live: 'Live now',
  ended: 'Ended',
  cancelled: 'Cancelled',
};

type MyListingRow = {
  id: string;
  title: string | null;
  address_text: string;
  start_date: string;
  end_date: string;
  daily_start_time: string;
  daily_end_time: string;
  status: string;
  view_count: number;
  favorite_count: number;
  checkin_count: number;
  is_boosted: boolean;
  listing_photos: DisplayPhotoRow[] | null;
};

export async function getMyListings(sellerId: string): Promise<MyListing[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('sale_listings')
    .select(
      `id, title, address_text, start_date, end_date, daily_start_time, daily_end_time,
       status, view_count, favorite_count, checkin_count, is_boosted,
       listing_photos(storage_key, sort_order, moderation_status, photo_type, created_at)`
    )
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return ((data ?? []) as unknown as MyListingRow[]).map((row) => {
    const status = deriveDisplayStatus(row.status, row.start_date, row.end_date);
    // Same "today's day_of photo leads" rule as the public pages, so a seller
    // sees their listing the way buyers do.
    const { photoUrls, hasFreshPhotoToday } = deriveDisplayPhotos(row.listing_photos, new Date());
    return {
      id: row.id,
      title: row.title?.trim() ? row.title : deriveTitle(row.address_text),
      status,
      // formatSaleSchedule applies formatTimeOfDay itself — pass the raw
      // Postgres time values, not pre-formatted ones.
      scheduleLabel: formatSaleSchedule({
        startDate: row.start_date,
        endDate: row.end_date,
        dailyStartTime: row.daily_start_time,
        dailyEndTime: row.daily_end_time,
      }),
      viewCount: row.view_count,
      favoriteCount: row.favorite_count,
      checkinCount: row.checkin_count,
      photoUrl: photoUrls[0] ?? null,
      hasFreshPhotoToday,
      isBoosted: row.is_boosted,
      isLiveToday: status === 'live',
    };
  });
}

export type EditableListing = {
  id: string;
  addressText: string;
  startDate: string;
  endDate: string;
  title: string;
  paymentMethod: 'cash_only' | 'cash_and_etransfer';
  description: string;
  otherItems: string[];
  categoryNames: string[];
  status: string;
  isDraft: boolean;
  isCancelled: boolean;
};

// Scoped to sellerId as well as id — the view's SELECT exposes every
// published listing, so this filter is what separates "fetch to display" from
// "fetch to edit". The DB enforces this independently as of
// 0038_sale_listings_view_write_authorization.sql; this just makes the UI
// refuse to open in the first place.
export async function getEditableListing(id: string, sellerId: string): Promise<EditableListing | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('sale_listings')
    .select(
      'id, address_text, start_date, end_date, title, payment_method, description, other_items, status, listing_categories(categories(name))'
    )
    .eq('id', id)
    .eq('seller_id', sellerId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as {
    id: string;
    address_text: string;
    start_date: string;
    end_date: string;
    title: string | null;
    payment_method: 'cash_only' | 'cash_and_etransfer';
    description: string | null;
    other_items: string[];
    status: string;
    listing_categories: { categories: { name: string } | null }[] | null;
  };

  return {
    id: row.id,
    addressText: row.address_text,
    startDate: row.start_date,
    endDate: row.end_date,
    title: row.title ?? '',
    paymentMethod: row.payment_method,
    description: row.description ?? '',
    otherItems: row.other_items ?? [],
    categoryNames: (row.listing_categories ?? [])
      .map((entry) => entry.categories?.name)
      .filter((name): name is string => Boolean(name)),
    status: row.status,
    isDraft: row.status === 'draft',
    isCancelled: row.status === 'cancelled',
  };
}
