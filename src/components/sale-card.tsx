import Image from "next/image";
import Link from "next/link";

import { FavoriteHeart } from "@/components/favorite-heart";
import { PriceTag } from "@/components/price-tag";
import { HOT_TIER_LABELS } from "@/lib/brand";
import type { Listing } from "@/lib/listings";
import { formatSaleSchedule } from "@/lib/format";

export function SaleCard({
  sale,
  currentUserId,
  isFavorited,
}: {
  sale: Listing;
  currentUserId: string | null;
  isFavorited: boolean;
}) {
  const photo = sale.photoUrls[0];

  return (
    <Link
      href={`/sale/${sale.id}`}
      className="flex gap-3 rounded-2xl border-2 border-tan-border bg-paper p-3 transition hover:border-coral"
    >
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-amber-bg">
        {photo ? (
          <Image src={photo} alt="" fill sizes="64px" className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl">🏷️</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate font-display text-sm font-semibold text-ink">{sale.title}</h3>
        </div>
        <p className="mt-0.5 text-xs text-muted">{formatSaleSchedule(sale)}</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {sale.hotTier && <PriceTag label={HOT_TIER_LABELS[sale.hotTier]} variant={sale.hotTier} rotate={-2} />}
          {sale.isBoosted && <PriceTag label="⭐ Featured" variant="boosted" rotate={-2} />}
          {sale.paymentMethod === "cash_and_etransfer" && (
            <PriceTag label="💸 Cash + e-Transfer" variant="etransfer" rotate={-2} />
          )}
        </div>
        {sale.categories.length > 0 && (
          <p className="mt-1.5 truncate text-xs text-muted">{sale.categories.join(" · ")}</p>
        )}
        <div className="mt-1.5">
          <FavoriteHeart
            listingId={sale.id}
            userId={currentUserId}
            initialFavorited={isFavorited}
            initialCount={sale.favoriteCount}
            redirectPath={`/sale/${sale.id}`}
            size="sm"
          />
        </div>
      </div>
    </Link>
  );
}
