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
