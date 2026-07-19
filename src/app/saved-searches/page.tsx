import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { SaleCard } from '@/components/sale-card';
import { SavedSearchForm } from '@/components/saved-search-form';
import { getFavoritedListingIdSet } from '@/lib/favorites-server';
import { getMatchesForSavedSearch } from '@/lib/matches-server';
import { getMySavedSearch } from '@/lib/saved-searches-server';
import { createClient } from '@/lib/supabase-server';

export const metadata: Metadata = { title: 'I’m looking for' };

export default async function SavedSearchesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Belt-and-suspenders — middleware already redirects unauthenticated
  // requests to /saved-searches, this just keeps the page safe standalone too.
  if (!user) redirect('/login?redirectTo=/saved-searches');

  const existing = await getMySavedSearch(user.id);
  const matches = existing ? await getMatchesForSavedSearch(existing.id) : [];
  const favoritedIds = existing
    ? await getFavoritedListingIdSet(user.id, matches.map((m) => m.listing.id))
    : new Set<string>();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <h1 className="font-display text-2xl font-semibold text-ink">I&apos;m looking for</h1>
      <p className="mt-1 text-sm text-muted">
        Save what you&apos;re after, and we&apos;ll email and notify you the moment a matching sale is listed.
      </p>

      <div className="mt-6">
        <SavedSearchForm userId={user.id} existing={existing} />
      </div>

      {existing && (
        <div className="mt-8">
          <h2 className="font-display text-lg font-semibold text-ink">
            Your matches ({matches.length})
          </h2>
          <div className="mt-3 flex flex-col gap-3">
            {matches.length === 0 && (
              <p className="rounded-2xl border-2 border-dashed border-tan-border bg-paper p-6 text-center text-sm text-muted">
                No matches yet — you&apos;ll see (and hear about) sales here as soon as one fits your search.
              </p>
            )}
            {matches.map(({ listing, isNew }) => (
              <div key={listing.id} className="relative">
                {isNew && (
                  <span className="absolute -top-2 left-3 z-10 rounded-full bg-coral px-2 py-0.5 text-xs font-semibold text-paper">
                    New
                  </span>
                )}
                <SaleCard sale={listing} currentUserId={user.id} isFavorited={favoritedIds.has(listing.id)} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
