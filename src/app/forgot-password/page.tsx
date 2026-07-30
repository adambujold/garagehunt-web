import type { Metadata } from 'next';
import Link from 'next/link';

import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export const metadata: Metadata = { title: 'Reset your password' };

// Step 1 of the recovery flow. Reached from the "Forgot password?" links on
// both the website's login page and the mobile app — the app deliberately
// sends people here rather than handling recovery in-app, because the reset
// email is very often opened on a different device from the one the app is
// installed on.
export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-16 sm:px-6">
      <h1 className="font-display text-2xl font-semibold text-ink">Reset your password</h1>
      <p className="text-sm text-muted">
        Enter the email you signed up with and we&apos;ll send you a link to set a new password.
      </p>

      <div className="rounded-2xl border-2 border-tan-border bg-paper p-5">
        <ForgotPasswordForm />
      </div>

      <p className="text-center text-sm text-muted">
        <Link href="/login" className="font-medium text-ink underline underline-offset-2">
          Back to log in
        </Link>
      </p>
    </div>
  );
}
