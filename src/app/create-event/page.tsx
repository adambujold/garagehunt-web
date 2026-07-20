import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { CreateEventForm } from '@/components/create-event-form';
import { getIsVerifiedOrganizer } from '@/lib/organizer-server';
import { createClient } from '@/lib/supabase-server';

export const metadata: Metadata = { title: 'Create an event' };

export default async function CreateEventPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirectTo=/create-event');

  const isVerifiedOrganizer = await getIsVerifiedOrganizer(user.id);
  if (!isVerifiedOrganizer) redirect('/organizer-application');

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <h1 className="font-display text-2xl font-semibold text-ink">Create a town-wide event</h1>
      <div className="mt-6">
        <CreateEventForm organizerId={user.id} />
      </div>
    </div>
  );
}
