// Ported from the mobile app's utils/mapbox-address-search.ts — same plain
// fetch-based calls to Mapbox's Search Box API, no SDK. Two-step flow:
// /suggest returns lightweight matches with no coordinates; /retrieve
// resolves one chosen suggestion to real coordinates. A session_token ties
// a suggest→retrieve sequence together for Mapbox's own billing purposes —
// generate one per typing session, not per keystroke.

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export type Coordinates = { latitude: number; longitude: number };

export type AddressSuggestion = {
  id: string;
  label: string;
};

export function createSearchSessionToken(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function suggestAddresses(
  query: string,
  sessionToken: string,
  proximityBias?: Coordinates
): Promise<AddressSuggestion[]> {
  if (!MAPBOX_TOKEN) throw new Error('Missing NEXT_PUBLIC_MAPBOX_TOKEN.');
  const trimmed = query.trim();
  if (!trimmed) return [];

  const params = new URLSearchParams({
    q: trimmed,
    access_token: MAPBOX_TOKEN,
    session_token: sessionToken,
    limit: '5',
    country: 'ca',
    types: 'address',
  });
  if (proximityBias) params.set('proximity', `${proximityBias.longitude},${proximityBias.latitude}`);

  const response = await fetch(`https://api.mapbox.com/search/searchbox/v1/suggest?${params.toString()}`);
  if (!response.ok) throw new Error(`Mapbox Search Box API request failed (${response.status}).`);

  const data = await response.json();
  const suggestions = (data.suggestions ?? []) as {
    mapbox_id: string;
    name: string;
    full_address?: string;
    place_formatted?: string;
  }[];

  return suggestions.map((s) => ({
    id: s.mapbox_id,
    label: s.full_address ?? [s.name, s.place_formatted].filter(Boolean).join(', '),
  }));
}

export async function retrieveAddress(
  mapboxId: string,
  sessionToken: string
): Promise<{ address: string; coordinates: Coordinates }> {
  if (!MAPBOX_TOKEN) throw new Error('Missing NEXT_PUBLIC_MAPBOX_TOKEN.');

  const params = new URLSearchParams({ access_token: MAPBOX_TOKEN, session_token: sessionToken });
  const response = await fetch(`https://api.mapbox.com/search/searchbox/v1/retrieve/${mapboxId}?${params.toString()}`);
  if (!response.ok) throw new Error(`Mapbox Search Box API request failed (${response.status}).`);

  const data = await response.json();
  const feature = data.features?.[0];
  if (!feature) throw new Error("Couldn't load that address. Please try again.");

  const [longitude, latitude] = feature.geometry.coordinates as [number, number];
  const address: string = feature.properties?.full_address ?? feature.properties?.name ?? '';
  return { address, coordinates: { latitude, longitude } };
}
