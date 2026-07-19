import type { Coordinates } from '@/lib/mapbox-address-search';

// Ported from the mobile app's utils/mapbox-geocoding.ts — one-shot forward
// geocode fallback for List a Sale's publish step, used only if the seller
// typed/edited an address without picking one of the live suggestions (so
// selectedCoords is still null). Same bbox+proximity disambiguation logic.

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const PROXIMITY_BBOX_DEGREES = 0.5;

export async function geocodeAddress(address: string, proximityBias?: Coordinates): Promise<Coordinates> {
  if (!MAPBOX_TOKEN) throw new Error('Missing NEXT_PUBLIC_MAPBOX_TOKEN.');
  const trimmed = address.trim();
  if (!trimmed) throw new Error('Enter an address so buyers can find this sale.');

  const params = new URLSearchParams({
    q: trimmed,
    access_token: MAPBOX_TOKEN,
    limit: '1',
    country: 'ca',
    autocomplete: 'false',
  });
  if (proximityBias) {
    params.set('proximity', `${proximityBias.longitude},${proximityBias.latitude}`);
    const d = PROXIMITY_BBOX_DEGREES;
    params.set(
      'bbox',
      [
        proximityBias.longitude - d,
        proximityBias.latitude - d,
        proximityBias.longitude + d,
        proximityBias.latitude + d,
      ].join(',')
    );
  }

  const response = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${params.toString()}`);
  if (!response.ok) throw new Error(`Mapbox Geocoding API request failed (${response.status}).`);

  const data = await response.json();
  const feature = data.features?.[0];
  if (!feature) throw new Error("Couldn't find that address. Please check it and try again.");

  const [longitude, latitude] = feature.geometry.coordinates as [number, number];
  return { latitude, longitude };
}
