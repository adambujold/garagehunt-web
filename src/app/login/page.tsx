import type { Metadata } from 'next';
import Link from 'next/link';

import { GoogleButton } from '@/components/auth/google-button';
import { LoginForm } from '@/components/auth/login-form';

export const metadata: Metadata = { title: 'Log in' };

type PageProps = { searchParams: Promise<{ redirectTo?: string; error?: string }> };

export default async function LoginPage({ searchParams }: PageProps) {
  const { redirectTo, error } = await searchParams;
  const target = redirectTo?.startsWith('/') ? redirectTo : '/';

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-16 sm:px-6">
      <h1 className="font-display text-2xl font-semibold text-ink">Log in</h1>

      <div className="flex flex-col gap-4 rounded-2xl border-2 border-tan-border bg-paper p-5">
        {error && <p className="rounded-lg bg-error-bg px-3 py-2 text-sm text-error-text">{error}</p>}

        <LoginForm redirectTo={target} />

        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-tan-border" />
          or
          <span className="h-px flex-1 bg-tan-border" />
        </div>

        <GoogleButton redirectTo={target} />
      </div>

      <p className="text-center text-sm text-muted">
        New to GarageHunt?{' '}
        <Link href={`/register${redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ''}`} className="font-medium text-ink underline underline-offset-2">
          Create an account
        </Link>
      </p>
    </div>
  );
}
