import { createClient } from '@/lib/supabase-browser';
import type { Coordinates } from '@/lib/mapbox-address-search';

// Ported from the mobile app's utils/town-wide-events.ts — just the
// seller-facing subset List a Sale needs (finding + requesting to join a
// nearby event), not the organizer-management functions.

function haversineDistanceKm(a: Coordinates, b: Coordinates): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export type NearbyTownWideEvent = {
  id: string;
  name: string;
  centerLatitude: number;
  centerLongitude: number;
  radiusKm: number;
};

export async function findNearbyEvent(params: {
  latitude: number;
  longitude: number;
  startDate: string;
  endDate: string;
}): Promise<NearbyTownWideEvent | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('town_wide_events')
    .select('id, name, center_latitude, center_longitude, radius_km')
    .lte('start_date', params.endDate)
    .gte('end_date', params.startDate)
    .eq('join_requests_enabled', true);

  if (error) throw error;

  const origin = { latitude: params.latitude, longitude: params.longitude };
  const match = (data ?? []).find(
    (event) =>
      haversineDistanceKm(origin, { latitude: event.center_latitude, longitude: event.center_longitude }) <=
      event.radius_km
  );
  if (!match) return null;

  return {
    id: match.id,
    name: match.name,
    centerLatitude: match.center_latitude,
    centerLongitude: match.center_longitude,
    radiusKm: match.radius_km,
  };
}

export async function fetchEventParticipantCount(eventId: string): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from('sale_listings')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('status', 'published');
  if (error) throw error;
  return count ?? 0;
}

export async function submitEventJoinRequest(params: {
  eventId: string;
  listingId: string;
  sellerId: string;
}): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('event_join_requests')
    .insert({ event_id: params.eventId, listing_id: params.listingId, seller_id: params.sellerId });
  if (error) throw error;
}

// Organizer-facing functions (Phase 4) — ported from the mobile app's
// utils/town-wide-events.ts. `origin`/`join_requests_enabled` are left
// unset on insert, same as mobile, relying on the DB column defaults
// ('association' / true).
export async function createTownWideEvent(input: {
  organizerId: string;
  name: string;
  centerLatitude: number;
  centerLongitude: number;
  radiusKm: number;
  startDate: string;
  endDate: string;
}): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('town_wide_events')
    .insert({
      organizer_id: input.organizerId,
      name: input.name,
      center_latitude: input.centerLatitude,
      center_longitude: input.centerLongitude,
      radius_km: input.radiusKm,
      start_date: input.startDate,
      end_date: input.endDate,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export type OrganizerEvent = {
  id: string;
  name: string;
  centerLatitude: number;
  centerLongitude: number;
  radiusKm: number;
  startDate: string;
  endDate: string;
};

export async function fetchOrganizerEvents(organizerId: string): Promise<OrganizerEvent[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('town_wide_events')
    .select('id, name, center_latitude, center_longitude, radius_km, start_date, end_date')
    .eq('organizer_id', organizerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    centerLatitude: row.center_latitude,
    centerLongitude: row.center_longitude,
    radiusKm: row.radius_km,
    startDate: row.start_date,
    endDate: row.end_date,
  }));
}

export type EventJoinRequest = {
  id: string;
  listingId: string;
  listingTitle: string | null;
  listingAddress: string;
  status: 'pending' | 'approved' | 'denied';
  createdAt: string;
};

export async function fetchJoinRequestsForEvent(eventId: string): Promise<EventJoinRequest[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('event_join_requests')
    .select('id, listing_id, status, created_at, sale_listings(address_text, title)')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as {
    id: string;
    listing_id: string;
    status: 'pending' | 'approved' | 'denied';
    created_at: string;
    sale_listings: { address_text: string; title: string | null } | null;
  }[]).map((row) => ({
    id: row.id,
    listingId: row.listing_id,
    listingTitle: row.sale_listings?.title ?? null,
    listingAddress: row.sale_listings?.address_text ?? '',
    status: row.status,
    createdAt: row.created_at,
  }));
}

// Setting sale_listings.event_id on approval is handled entirely by a DB
// trigger (sync_listing_event_id, mobile repo's 0014_town_wide_events.sql)
// — the organizer has no RLS path to update sale_listings directly, same
// as mobile.
export async function updateEventJoinRequestStatus(requestId: string, status: 'approved' | 'denied'): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('event_join_requests').update({ status }).eq('id', requestId);
  if (error) throw error;
}
