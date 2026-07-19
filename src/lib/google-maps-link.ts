import type { Coordinates } from '@/lib/mapbox-address-search';

// Google's documented multi-stop Directions URL format:
// https://developers.google.com/maps/documentation/urls/get-started#directions-action
// origin/destination are the route's first/last stop; everything between
// goes in the pipe-separated waypoints param, in visit order.
export function buildGoogleMapsUrl(origin: Coordinates, orderedStops: Coordinates[]): string {
  if (orderedStops.length === 0) return '';

  const destination = orderedStops[orderedStops.length - 1];
  const waypoints = orderedStops.slice(0, -1);

  const params = new URLSearchParams({
    api: '1',
    origin: `${origin.latitude},${origin.longitude}`,
    destination: `${destination.latitude},${destination.longitude}`,
    travelmode: 'driving',
  });
  if (waypoints.length > 0) {
    params.set('waypoints', waypoints.map((w) => `${w.latitude},${w.longitude}`).join('|'));
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
