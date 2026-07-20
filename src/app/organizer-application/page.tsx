import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { OrganizerApplicationForm } from '@/components/organizer-application-form';
import { getLatestOrganizerApplication } from '@/lib/organizer-server';
import { createClient } from '@/lib/supabase-server';

export const metadata: Metadata = { title: 'Become an organizer' };

const STATUS_COPY = {
  pending: {
    title: 'Application submitted',
    body: "We'll review it soon and follow up by email.",
  },
  approved: {
    title: "You're a verified organizer!",
    body: 'You can now set up town-wide events for your neighborhood.',
  },
} as const;

export default async function OrganizerApplicationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirectTo=/organizer-application');

  const existing = await getLatestOrganizerApplication(user.id);
  // A denied application falls through to the form again (with a note) —
  // pending/approved block the form and show the status view instead,
  // same as mobile.
  const statusToShow = existing && existing.status !== 'denied' ? existing.status : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <h1 className="font-display text-2xl font-semibold text-ink">Become an organizer</h1>
      <p className="mt-1 text-sm text-muted">
        Verified organizers can create and manage town-wide sale events for their neighborhood.
      </p>

      {statusToShow ? (
        <div className="mt-6 rounded-2xl border-2 border-tan-border bg-paper p-5">
          <h2 className="font-display text-lg font-semibold text-ink">{STATUS_COPY[statusToShow].title}</h2>
          <p className="mt-1 text-sm text-muted">{STATUS_COPY[statusToShow].body}</p>
          {statusToShow === 'approved' && (
            <Link
              href="/organizer-dashboard"
              className="mt-4 inline-block rounded-full bg-coral px-4 py-2.5 font-display text-sm font-semibold text-paper hover:bg-[#e55a3c]"
            >
              Go to your dashboard
            </Link>
          )}
        </div>
      ) : (
        <div className="mt-6">
          {existing?.status === 'denied' && (
            <p className="mb-4 rounded-lg bg-error-bg px-3 py-2 text-sm text-error-text">
              Your previous application wasn&apos;t approved. You&apos;re welcome to apply again below.
            </p>
          )}
          <OrganizerApplicationForm userId={user.id} initialFullName={user.user_metadata?.full_name ?? ''} />
        </div>
      )}
    </div>
  );
}
