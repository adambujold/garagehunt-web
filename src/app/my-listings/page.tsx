import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PriceTag } from "@/components/price-tag";
import { HOT_TIER_LABELS, deriveHotTier, type PriceTagVariant } from "@/lib/brand";
import { getMyListings, STATUS_LABELS, type DisplayStatus, type MyListing } from "@/lib/my-listings";
import { createClient } from "@/lib/supabase-server";

// The seller dashboard the website never had — a web seller could publish a
// listing and then had no way to see it again, let alone edit it. Mirrors the
// app's my-listings.tsx.
export const metadata: Metadata = {
  title: "My Listings",
  robots: { index: false, follow: false },
};

const STATUS_VARIANTS: Record<DisplayStatus, PriceTagVariant> = {
  draft: "draft",
  scheduled: "scheduled",
  live: "live",
  ended: "ended",
  cancelled: "cancelled",
};

export default async function MyListingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/my-listings");

  const listings = await getMyListings(user.id);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">My Listings</h1>
          <p className="mt-1 text-sm text-muted">
            {listings.length === 0
              ? "You haven't listed a sale yet."
              : `${listings.length} ${listings.length === 1 ? "sale" : "sales"}`}
          </p>
        </div>
        <Link
          href="/list-a-sale"
          className="rounded-full bg-coral px-4 py-2 text-sm font-semibold text-paper transition hover:opacity-90"
        >
          + List a Sale
        </Link>
      </div>

      {listings.length === 0 ? (
        <div className="mt-8 rounded-2xl border-2 border-dashed border-tan-border bg-paper p-8 text-center">
          <p className="text-sm text-muted">
            Your sales will show up here once you list one — along with views, interest, and check-ins.
          </p>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {listings.map((listing) => (
            <li key={listing.id}>
              <ListingRow listing={listing} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ListingRow({ listing }: { listing: MyListing }) {
  const hotTier = deriveHotTier(listing.favoriteCount);

  return (
    <div
      className={`rounded-2xl border-2 bg-paper p-3 ${
        listing.status === "draft" ? "border-dashed border-tan-border" : "border-tan-border"
      } ${listing.status === "cancelled" ? "opacity-60" : ""}`}
    >
      <div className="flex gap-3">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-amber-bg">
          {listing.photoUrl ? (
            <Image src={listing.photoUrl} alt="" fill sizes="64px" className="object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl">🏷️</div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-sm font-semibold text-ink">{listing.title}</h2>
          <p className="mt-0.5 text-xs text-muted">{listing.scheduleLabel}</p>

          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <PriceTag
              label={STATUS_LABELS[listing.status]}
              variant={STATUS_VARIANTS[listing.status]}
              rotate={-2}
            />
            {listing.hasFreshPhotoToday && <PriceTag label="📸 Fresh Photos" variant="fresh" rotate={-2} />}
            {listing.isBoosted && <PriceTag label="⭐ Featured" variant="boosted" rotate={-2} />}
            {hotTier && <PriceTag label={HOT_TIER_LABELS[hotTier]} variant={hotTier} rotate={-3} />}
          </div>

          {listing.status !== "draft" && (
            <p className="mt-2 text-xs text-muted">
              {listing.viewCount} {listing.viewCount === 1 ? "view" : "views"} · {listing.favoriteCount}{" "}
              interested · {listing.checkinCount} checked in
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 border-t-2 border-tan-border pt-3">
        <Link
          href={`/edit-listing/${listing.id}`}
          className="rounded-full border-2 border-tan-border bg-white px-3 py-1.5 text-xs font-medium text-ink transition hover:border-coral"
        >
          {listing.status === "draft" ? "Finish listing" : "Edit"}
        </Link>
        {/* Only while the sale is actually running — the same condition that
            decides whether the day-of reminder fires at all. */}
        {listing.isLiveToday && (
          <Link
            href={`/day-of-photos/${listing.id}`}
            className="rounded-full border-2 border-tan-border bg-white px-3 py-1.5 text-xs font-medium text-ink transition hover:border-coral"
          >
            📸 Add today&apos;s photos
          </Link>
        )}
        {listing.status !== "draft" && (
          <Link
            href={`/sale/${listing.id}`}
            className="rounded-full px-3 py-1.5 text-xs font-medium text-muted underline underline-offset-2 hover:text-ink"
          >
            View public page
          </Link>
        )}
      </div>
    </div>
  );
}
