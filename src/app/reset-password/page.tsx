import type { Metadata } from 'next';
import Link from 'next/link';

import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { createClient } from '@/lib/supabase-server';

export const metadata: Metadata = { title: 'Set a new password', robots: { index: false, follow: false } };

// Step 2 of the recovery flow. Getting here requires the session that
// /auth/callback established from the emailed link, so an active session is
// itself the proof that this person received the email. Someone landing here
// without one gets told to request a fresh link rather than a confusing
// failure after they've typed a new password.
export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-16 sm:px-6">
        <h1 className="font-display text-2xl font-semibold text-ink">That link has expired</h1>
        <p className="text-sm text-muted">
          Reset links are single-use and time-limited. Request a new one and it&apos;ll work.
        </p>
        <Link
          href="/forgot-password"
          className="rounded-full bg-coral px-4 py-2.5 text-center font-display text-sm font-semibold text-paper"
        >
          Send a new link
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-16 sm:px-6">
      <h1 className="font-display text-2xl font-semibold text-ink">Set a new password</h1>
      <p className="text-sm text-muted">for {user.email}</p>

      <div className="rounded-2xl border-2 border-tan-border bg-paper p-5">
        <ResetPasswordForm />
      </div>
    </div>
  );
}
