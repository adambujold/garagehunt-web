import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { JoinRequestActions } from '@/components/join-request-actions';
import { SaleCard } from '@/components/sale-card';
import { formatSaleDateRange } from '@/lib/format';
import { getFavoritedListingIdSet } from '@/lib/favorites-server';
import { getListingsForEvent } from '@/lib/listings';
import {
  getEventParticipantCount,
  getJoinRequestsForEvent,
  getOrganizerEventById,
} from '@/lib/organizer-events-server';
import { createClient } from '@/lib/supabase-server';

export const metadata: Metadata = { title: 'Manage event' };

type PageProps = { params: Promise<{ id: string }> };

export default async function OrganizerEventPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirectTo=/organizer-event/${id}`);

  const event = await getOrganizerEventById(id, user.id);
  if (!event) notFound();

  const [joinRequests, joinedListings, participantCount] = await Promise.all([
    getJoinRequestsForEvent(event.id),
    getListingsForEvent(event.id),
    getEventParticipantCount(event.id),
  ]);
  const pendingRequests = joinRequests.filter((r) => r.status === 'pending');
  const favoritedIds = await getFavoritedListingIdSet(user.id, joinedListings.map((l) => l.id));

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <p className="font-tag text-sm font-bold text-violet">Managing</p>
      <h1 className="mt-1 font-display text-2xl font-semibold text-ink text-balance">{event.name}</h1>
      <p className="mt-1 text-sm text-muted">
        {formatSaleDateRange(event.startDate, event.endDate)} · {event.radiusKm} km radius · {participantCount}{' '}
        {participantCount === 1 ? 'sale' : 'sales'} joined
      </p>

      <div className="mt-8">
        <h2 className="font-display text-lg font-semibold text-ink">
          Join requests {pendingRequests.length > 0 && `(${pendingRequests.length})`}
        </h2>
        <div className="mt-3 flex flex-col gap-2">
          {pendingRequests.length === 0 && (
            <p className="rounded-2xl border-2 border-dashed border-tan-border bg-paper p-6 text-center text-sm text-muted">
              No pending join requests right now.
            </p>
          )}
          {pendingRequests.map((request) => (
            <JoinRequestActions key={request.id} request={request} />
          ))}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="font-display text-lg font-semibold text-ink">Joined sales</h2>
        <div className="mt-3 flex flex-col gap-3">
          {joinedListings.length === 0 && (
            <p className="rounded-2xl border-2 border-dashed border-tan-border bg-paper p-6 text-center text-sm text-muted">
              No sales have joined this event yet.
            </p>
          )}
          {joinedListings.map((sale) => (
            <SaleCard key={sale.id} sale={sale} currentUserId={user.id} isFavorited={favoritedIds.has(sale.id)} />
          ))}
        </div>
      </div>
    </div>
  );
}
