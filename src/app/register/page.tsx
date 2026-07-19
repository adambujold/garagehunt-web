import type { Metadata } from 'next';
import Link from 'next/link';

import { GoogleButton } from '@/components/auth/google-button';
import { RegisterForm } from '@/components/auth/register-form';

export const metadata: Metadata = { title: 'Create an account' };

type PageProps = { searchParams: Promise<{ redirectTo?: string }> };

export default async function RegisterPage({ searchParams }: PageProps) {
  const { redirectTo } = await searchParams;
  const target = redirectTo?.startsWith('/') ? redirectTo : '/';

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-16 sm:px-6">
      <h1 className="font-display text-2xl font-semibold text-ink">Create an account</h1>

      <div className="flex flex-col gap-4 rounded-2xl border-2 border-tan-border bg-paper p-5">
        <RegisterForm redirectTo={target} />

        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-tan-border" />
          or
          <span className="h-px flex-1 bg-tan-border" />
        </div>

        <GoogleButton redirectTo={target} />
      </div>

      <p className="text-center text-sm text-muted">
        Already have an account?{' '}
        <Link href={`/login${redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ''}`} className="font-medium text-ink underline underline-offset-2">
          Log in
        </Link>
      </p>
    </div>
  );
}
