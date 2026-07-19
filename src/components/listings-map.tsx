"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Map, { Marker, Popup } from "react-map-gl/mapbox";

import { Colors } from "@/lib/brand";
import type { Listing } from "@/lib/listings";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// The interactive island within an otherwise server-rendered page — Mapbox
// GL only runs client-side, but the page around it (title, list, meta
// tags) stays fully server-rendered for SEO. Mirrors the mobile app's
// Mapbox account/data; different library per feature spec Section 13's
// "what's different on web" callout.
export function ListingsMap({
  listings,
  center,
  zoom = 11,
}: {
  listings: Pick<Listing, "id" | "title" | "latitude" | "longitude">[];
  center?: { latitude: number; longitude: number };
  zoom?: number;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = listings.find((l) => l.id === activeId);

  const initialViewState = useMemo(() => {
    const focus = center ?? listings[0];
    return {
      latitude: focus?.latitude ?? 42.9849,
      longitude: focus?.longitude ?? -81.2453,
      zoom,
    };
  }, [center, listings, zoom]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border-2 border-tan-border bg-amber-bg text-sm text-amber-text">
        Map unavailable
      </div>
    );
  }

  return (
    <Map
      mapboxAccessToken={MAPBOX_TOKEN}
      initialViewState={initialViewState}
      style={{ width: "100%", height: "100%" }}
      mapStyle="mapbox://styles/mapbox/light-v11"
    >
      {listings.map((listing) => (
        <Marker
          key={listing.id}
          latitude={listing.latitude}
          longitude={listing.longitude}
          onClick={(e) => {
            e.originalEvent.stopPropagation();
            setActiveId(listing.id);
          }}
        >
          <span
            aria-hidden
            className="block h-4 w-4 cursor-pointer rounded-full border-2 border-paper shadow"
            style={{ backgroundColor: Colors.coral }}
          />
        </Marker>
      ))}
      {active && (
        <Popup
          latitude={active.latitude}
          longitude={active.longitude}
          onClose={() => setActiveId(null)}
          closeButton={false}
          offset={12}
        >
          <Link href={`/sale/${active.id}`} className="font-display text-sm font-medium text-ink">
            {active.title}
          </Link>
        </Popup>
      )}
    </Map>
  );
}
