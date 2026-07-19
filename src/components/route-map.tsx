"use client";

import { useMemo } from "react";
import Map, { Layer, Marker, Source } from "react-map-gl/mapbox";

import { Colors } from "@/lib/brand";
import type { Coordinates } from "@/lib/mapbox-address-search";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export function RouteMap({
  origin,
  stops,
  geometry,
}: {
  origin: Coordinates;
  stops: Coordinates[];
  geometry: [number, number][];
}) {
  const initialViewState = useMemo(
    () => ({ latitude: origin.latitude, longitude: origin.longitude, zoom: 11 }),
    [origin]
  );

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border-2 border-tan-border bg-amber-bg text-sm text-amber-text">
        Map unavailable
      </div>
    );
  }

  const routeGeoJson = {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "LineString" as const, coordinates: geometry },
  };

  return (
    <Map
      mapboxAccessToken={MAPBOX_TOKEN}
      initialViewState={initialViewState}
      style={{ width: "100%", height: "100%" }}
      mapStyle="mapbox://styles/mapbox/light-v11"
    >
      {geometry.length > 1 && (
        <Source id="route" type="geojson" data={routeGeoJson}>
          <Layer
            id="route-line"
            type="line"
            layout={{ "line-join": "round", "line-cap": "round" }}
            paint={{ "line-color": Colors.coral, "line-width": 4 }}
          />
        </Source>
      )}

      <Marker latitude={origin.latitude} longitude={origin.longitude}>
        <span
          aria-hidden
          className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-paper text-xs font-bold text-paper shadow"
          style={{ backgroundColor: Colors.ink }}
        >
          •
        </span>
      </Marker>

      {stops.map((stop, i) => (
        <Marker key={i} latitude={stop.latitude} longitude={stop.longitude}>
          <span
            aria-hidden
            className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-paper text-xs font-bold text-paper shadow"
            style={{ backgroundColor: Colors.coral }}
          >
            {i + 1}
          </span>
        </Marker>
      ))}
    </Map>
  );
}
