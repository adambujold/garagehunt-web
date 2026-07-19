import type { Metadata } from "next";

import { SaleCard } from "@/components/sale-card";
import { ListingsMap } from "@/components/listings-map";
import { getFavoritedListingIdSet } from "@/lib/favorites-server";
import { getPublishedListings } from "@/lib/listings";
import { createClient } from "@/lib/supabase-server";

export const metadata: Metadata = {
  title: "Find garage sales near you",
  description:
    "Browse live and upcoming garage sales, yard sales, and town-wide sale events across Canada. See what's for sale before you go.",
};

export const revalidate = 60;

export default async function DiscoverPage() {
  const listings = await getPublishedListings();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const favoritedIds = user
    ? await getFavoritedListingIdSet(user.id, listings.map((sale) => sale.id))
    : new Set<string>();

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <h1 className="font-display text-2xl font-semibold text-ink">Garage sales near you</h1>
      <p className="mt-1 text-sm text-muted">
        {listings.length} {listings.length === 1 ? "sale" : "sales"} listed right now
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col gap-3">
          {listings.length === 0 && (
            <p className="rounded-2xl border-2 border-dashed border-tan-border bg-paper p-6 text-center text-sm text-muted">
              No sales listed yet — check back soon.
            </p>
          )}
          {listings.map((sale) => (
            <SaleCard key={sale.id} sale={sale} currentUserId={user?.id ?? null} isFavorited={favoritedIds.has(sale.id)} />
          ))}
        </div>

        <div className="h-80 overflow-hidden rounded-2xl border-2 border-tan-border lg:sticky lg:top-6 lg:h-[calc(100vh-8rem)]">
          <ListingsMap listings={listings} />
        </div>
      </div>
    </div>
  );
}
