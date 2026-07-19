'use client';

import { useActionState } from 'react';

import { login } from '@/app/auth/actions';

const inputClass =
  'w-full rounded-xl border-2 border-tan-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-coral';

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [state, formAction, isPending] = useActionState(login, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="redirectTo" value={redirectTo} />

      {state?.error && (
        <p className="rounded-lg bg-error-bg px-3 py-2 text-sm text-error-text">{state.error}</p>
      )}

      <label className="flex flex-col gap-1 text-sm font-medium text-ink">
        Email
        <input type="email" name="email" autoComplete="email" required className={inputClass} />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-ink">
        Password
        <input type="password" name="password" autoComplete="current-password" required className={inputClass} />
      </label>

      <button
        type="submit"
        disabled={isPending}
        className="mt-1 rounded-full bg-coral px-4 py-2.5 font-display text-sm font-semibold text-paper transition hover:bg-[#e55a3c] disabled:opacity-60"
      >
        {isPending ? 'Logging in…' : 'Log in'}
      </button>
    </form>
  );
}
