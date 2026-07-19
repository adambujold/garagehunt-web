import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SaleCard } from "@/components/sale-card";
import { ListingsMap } from "@/components/listings-map";
import { formatSaleDateRange } from "@/lib/format";
import { getFavoritedListingIdSet } from "@/lib/favorites-server";
import { getEventById, getListingsForEvent } from "@/lib/listings";
import { createClient } from "@/lib/supabase-server";

export const revalidate = 60;

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const event = await getEventById(id);
  if (!event) return { title: "Event not found" };

  const description = `${formatSaleDateRange(event.startDate, event.endDate)} — browse every garage sale taking part in ${event.name}.`;
  return {
    title: event.name,
    description,
    openGraph: { title: event.name, description, type: "website" },
  };
}

export default async function EventPage({ params }: PageProps) {
  const { id } = await params;
  const [event, listings] = await Promise.all([getEventById(id), getListingsForEvent(id)]);
  if (!event) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const favoritedIds = user
    ? await getFavoritedListingIdSet(user.id, listings.map((sale) => sale.id))
    : new Set<string>();

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <p className="font-tag text-sm font-bold text-violet">Town-wide sale event</p>
      <h1 className="mt-1 font-display text-2xl font-semibold text-ink text-balance">{event.name}</h1>
      <p className="mt-1 text-sm text-muted">{formatSaleDateRange(event.startDate, event.endDate)}</p>
      <p className="mt-1 text-sm text-muted">
        {listings.length} {listings.length === 1 ? "sale" : "sales"} taking part
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col gap-3">
          {listings.length === 0 && (
            <p className="rounded-2xl border-2 border-dashed border-tan-border bg-paper p-6 text-center text-sm text-muted">
              No sales have joined this event yet — check back soon.
            </p>
          )}
          {listings.map((sale) => (
            <SaleCard key={sale.id} sale={sale} currentUserId={user?.id ?? null} isFavorited={favoritedIds.has(sale.id)} />
          ))}
        </div>

        <div className="h-80 overflow-hidden rounded-2xl border-2 border-tan-border lg:sticky lg:top-6 lg:h-[calc(100vh-8rem)]">
          <ListingsMap
            listings={listings}
            center={{ latitude: event.centerLatitude, longitude: event.centerLongitude }}
            zoom={12}
          />
        </div>
      </div>
    </div>
  );
}
