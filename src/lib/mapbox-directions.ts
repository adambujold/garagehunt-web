import type { Coordinates } from '@/lib/mapbox-address-search';

// Ported from the mobile app's utils/mapbox-directions.ts — same plain
// fetch call to the Mapbox Optimization API v1, no SDK, no rework needed.

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export type OptimizedRoute = {
  orderedStopIndexes: number[];
  distanceMeters: number;
  durationSeconds: number;
  geometry: [number, number][];
};

export async function getOptimizedRoute(origin: Coordinates, stops: Coordinates[]): Promise<OptimizedRoute> {
  if (!MAPBOX_TOKEN) throw new Error('Missing NEXT_PUBLIC_MAPBOX_TOKEN.');
  if (stops.length === 0) throw new Error('Add at least one stop to plan a route.');

  const coordinates = [origin, ...stops].map((point) => `${point.longitude},${point.latitude}`).join(';');

  const url =
    `https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${coordinates}` +
    `?roundtrip=false&source=first&destination=last&geometries=geojson&overview=full` +
    `&access_token=${MAPBOX_TOKEN}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Mapbox Optimization API request failed (${response.status}).`);

  const data = await response.json();
  if (data.code !== 'Ok' || !data.trips?.[0]) {
    throw new Error("Couldn't calculate a route between these stops.");
  }

  const trip = data.trips[0];
  const orderedStopIndexes = (data.waypoints as { waypoint_index: number }[])
    .map((waypoint, originalIndex) => ({ waypoint, originalIndex }))
    .filter(({ originalIndex }) => originalIndex !== 0)
    .sort((a, b) => a.waypoint.waypoint_index - b.waypoint.waypoint_index)
    .map(({ originalIndex }) => originalIndex - 1);

  return {
    orderedStopIndexes,
    distanceMeters: trip.distance,
    durationSeconds: trip.duration,
    geometry: trip.geometry.coordinates as [number, number][],
  };
}
