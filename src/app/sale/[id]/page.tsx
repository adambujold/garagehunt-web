import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FavoriteHeart } from "@/components/favorite-heart";
import { PriceTag } from "@/components/price-tag";
import { ListingsMap } from "@/components/listings-map";
import { HOT_TIER_LABELS } from "@/lib/brand";
import { formatSaleSchedule } from "@/lib/format";
import { getFavoritedListingIdSet } from "@/lib/favorites-server";
import { getListingById } from "@/lib/listings";
import { createClient } from "@/lib/supabase-server";

export const revalidate = 60;

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const sale = await getListingById(id);
  if (!sale) return { title: "Sale not found" };

  const description = sale.description || `${formatSaleSchedule(sale)} near ${sale.addressLabel}.`;
  const image = sale.photoUrls[0];

  return {
    title: sale.title,
    description,
    openGraph: {
      title: sale.title,
      description,
      type: "article",
      images: image ? [{ url: image }] : undefined,
    },
  };
}

export default async function SaleDetailPage({ params }: PageProps) {
  const { id } = await params;
  const sale = await getListingById(id);
  if (!sale) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const favoritedIds = user ? await getFavoritedListingIdSet(user.id, [sale.id]) : new Set<string>();

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <Link href="/" className="text-sm text-muted underline underline-offset-2 hover:text-ink">
        ← Back to all sales
      </Link>

      {sale.photoUrls.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {sale.photoUrls.map((url, i) => (
            <div
              key={url}
              className={`relative overflow-hidden rounded-2xl bg-amber-bg ${
                i === 0 ? "col-span-2 aspect-[4/3] sm:col-span-3" : "aspect-square"
              }`}
            >
              <Image
                src={url}
                alt=""
                fill
                sizes={i === 0 ? "100vw" : "33vw"}
                className="object-cover"
                priority={i === 0}
              />
            </div>
          ))}
        </div>
      )}

      <h1 className="mt-5 font-display text-3xl font-semibold text-ink text-balance">{sale.title}</h1>
      <p className="mt-1 text-sm text-muted">{sale.addressLabel}</p>
      <p className="mt-1 text-sm font-medium text-ink">{formatSaleSchedule(sale)}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {sale.hotTier && <PriceTag label={HOT_TIER_LABELS[sale.hotTier]} variant={sale.hotTier} rotate={-2} />}
        {sale.isBoosted && <PriceTag label="⭐ Featured" variant="boosted" rotate={-2} />}
        {sale.paymentMethod === "cash_and_etransfer" && (
          <PriceTag label="💸 Cash + e-Transfer" variant="etransfer" rotate={-2} />
        )}
        {sale.categories.map((category) => (
          <PriceTag key={category} label={category} variant="category" rotate={1} />
        ))}
      </div>

      <div className="mt-3">
        <FavoriteHeart
          listingId={sale.id}
          userId={user?.id ?? null}
          initialFavorited={favoritedIds.has(sale.id)}
          initialCount={sale.favoriteCount}
          redirectPath={`/sale/${sale.id}`}
          size="lg"
        />
      </div>

      {sale.description && (
        <p className="mt-4 whitespace-pre-line text-sm leading-6 text-ink">{sale.description}</p>
      )}

      {sale.otherItems.length > 0 && (
        <div className="mt-4">
          <h2 className="font-display text-sm font-semibold text-ink">Other items</h2>
          <p className="mt-1 text-sm text-muted">{sale.otherItems.join(", ")}</p>
        </div>
      )}

      <div className="mt-6 h-72 overflow-hidden rounded-2xl border-2 border-tan-border">
        <ListingsMap listings={[sale]} center={{ latitude: sale.latitude, longitude: sale.longitude }} zoom={14} />
      </div>

      {!sale.isRevealed && (
        <p className="mt-2 text-xs text-muted">
          The exact address is shown closer to the sale date — the map above is approximate.
        </p>
      )}
    </div>
  );
}
