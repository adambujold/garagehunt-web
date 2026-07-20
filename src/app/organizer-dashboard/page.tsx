import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { formatSaleDateRange } from '@/lib/format';
import { getJoinRequestsForEvent, getOrganizerEvents } from '@/lib/organizer-events-server';
import { getIsVerifiedOrganizer } from '@/lib/organizer-server';
import { createClient } from '@/lib/supabase-server';

export const metadata: Metadata = { title: 'Organizer dashboard' };

export default async function OrganizerDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirectTo=/organizer-dashboard');

  // Real gate, stricter than mobile's (mobile only enforces this at the DB
  // level on event creation) — sends a non-organizer straight to the
  // application flow instead of showing them an empty dashboard.
  const isVerifiedOrganizer = await getIsVerifiedOrganizer(user.id);
  if (!isVerifiedOrganizer) redirect('/organizer-application');

  const events = await getOrganizerEvents(user.id);
  const pendingCounts = await Promise.all(
    events.map(async (event) => {
      const requests = await getJoinRequestsForEvent(event.id);
      return requests.filter((r) => r.status === 'pending').length;
    })
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink">Your events</h1>
        <Link
          href="/create-event"
          className="rounded-full bg-coral px-4 py-2 text-sm font-semibold text-paper hover:bg-[#e55a3c]"
        >
          + Create event
        </Link>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {events.length === 0 && (
          <p className="rounded-2xl border-2 border-dashed border-tan-border bg-paper p-6 text-center text-sm text-muted">
            You haven&apos;t created an event yet.{' '}
            <Link href="/create-event" className="font-medium text-ink underline underline-offset-2">
              Create your first event
            </Link>
          </p>
        )}
        {events.map((event, i) => (
          <Link
            key={event.id}
            href={`/organizer-event/${event.id}`}
            className="flex items-center justify-between gap-3 rounded-2xl border-2 border-tan-border bg-paper p-4 transition hover:border-coral"
          >
            <div className="flex flex-col gap-1">
              <span className="font-display text-lg font-semibold text-ink">{event.name}</span>
              <span className="text-sm text-muted">
                {formatSaleDateRange(event.startDate, event.endDate)} · {event.radiusKm} km radius
              </span>
            </div>
            {pendingCounts[i] > 0 && (
              <span className="shrink-0 rounded-full bg-coral px-2.5 py-1 text-xs font-semibold text-paper">
                {pendingCounts[i]} pending
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
