import { createClient } from '@/lib/supabase-server';
import type { EventJoinRequest, OrganizerEvent } from '@/lib/town-wide-events';

// Server-Component read path for the organizer dashboard/event-detail
// pages — mirrors src/lib/town-wide-events.ts's browser-client organizer
// functions, just via the server client.

export async function getOrganizerEvents(organizerId: string): Promise<OrganizerEvent[]> {
  const supabase = await createClient();
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

export type OrganizerEventDetail = OrganizerEvent & { organizerId: string };

// Scoped to organizerId (not just id) so an organizer can't be handed
// another organizer's event just by guessing/visiting a URL — town_wide_events'
// SELECT policy is "viewable by everyone", so this filter is the only thing
// standing between "fetch for display" and "fetch for management".
export async function getOrganizerEventById(id: string, organizerId: string): Promise<OrganizerEventDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('town_wide_events')
    .select('id, organizer_id, name, center_latitude, center_longitude, radius_km, start_date, end_date')
    .eq('id', id)
    .eq('organizer_id', organizerId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    organizerId: data.organizer_id,
    name: data.name,
    centerLatitude: data.center_latitude,
    centerLongitude: data.center_longitude,
    radiusKm: data.radius_km,
    startDate: data.start_date,
    endDate: data.end_date,
  };
}

export async function getJoinRequestsForEvent(eventId: string): Promise<EventJoinRequest[]> {
  const supabase = await createClient();
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

export async function getEventParticipantCount(eventId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from('sale_listings')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('status', 'published');
  if (error) throw error;
  return count ?? 0;
}
