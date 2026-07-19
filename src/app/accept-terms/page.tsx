import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AcceptTermsForm } from '@/components/auth/accept-terms-form';
import { createClient } from '@/lib/supabase-server';

export const metadata: Metadata = { title: 'One more step' };

type PageProps = { searchParams: Promise<{ redirectTo?: string }> };

export default async function AcceptTermsPage({ searchParams }: PageProps) {
  const { redirectTo } = await searchParams;
  const target = redirectTo?.startsWith('/') ? redirectTo : '/';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirectTo=${encodeURIComponent(target)}`);

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-16 sm:px-6">
      <h1 className="font-display text-2xl font-semibold text-ink">One more step</h1>
      <p className="text-sm text-muted">
        Before you continue, please review and accept our Terms of Service and Privacy Policy.
      </p>
      <div className="rounded-2xl border-2 border-tan-border bg-paper p-5">
        <AcceptTermsForm redirectTo={target} />
      </div>
    </div>
  );
}
