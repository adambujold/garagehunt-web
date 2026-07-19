import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { SaleCard } from '@/components/sale-card';
import { getFavoritedListingIds } from '@/lib/favorites-server';
import { getListingsByIds } from '@/lib/listings';
import { createClient } from '@/lib/supabase-server';

export const metadata: Metadata = { title: 'Your favorites' };

export default async function FavoritesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Belt-and-suspenders — middleware already redirects unauthenticated
  // requests to /favorites, this just keeps the page safe standalone too.
  if (!user) redirect('/login?redirectTo=/favorites');

  const favoritedIds = await getFavoritedListingIds(user.id);
  const listings = await getListingsByIds(favoritedIds);

  // getListingsByIds doesn't preserve order — re-sort to match
  // favoritedIds' most-recently-favorited-first order.
  const order = new Map(favoritedIds.map((id, i) => [id, i]));
  const sorted = [...listings].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <h1 className="font-display text-2xl font-semibold text-ink">Your favorites</h1>
      <p className="mt-1 text-sm text-muted">
        {sorted.length} {sorted.length === 1 ? 'sale' : 'sales'} you&apos;ve favorited
      </p>

      <div className="mt-6 flex flex-col gap-3">
        {sorted.length === 0 && (
          <p className="rounded-2xl border-2 border-dashed border-tan-border bg-paper p-6 text-center text-sm text-muted">
            You haven&apos;t favorited any sales yet — tap the heart on a listing to save it here.
          </p>
        )}
        {sorted.map((sale) => (
          <SaleCard key={sale.id} sale={sale} currentUserId={user.id} isFavorited={true} />
        ))}
      </div>
    </div>
  );
}
