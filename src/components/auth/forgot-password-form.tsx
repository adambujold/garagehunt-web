'use client';

import { useActionState } from 'react';

import { requestPasswordReset } from '@/app/auth/actions';

const inputClass =
  'w-full rounded-xl border-2 border-tan-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-coral';

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(requestPasswordReset, undefined);

  // On success the action returns `info` rather than redirecting, so the
  // confirmation replaces the form — resubmitting the same address does
  // nothing useful and just invites people to spam themselves.
  if (state?.info) {
    return <p className="rounded-lg bg-amber-bg px-3 py-2 text-sm text-amber-text">{state.info}</p>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state?.error && (
        <p className="rounded-lg bg-error-bg px-3 py-2 text-sm text-error-text">{state.error}</p>
      )}

      <label className="flex flex-col gap-1 text-sm font-medium text-ink">
        Email
        <input type="email" name="email" autoComplete="email" required className={inputClass} />
      </label>

      <button
        type="submit"
        disabled={isPending}
        className="mt-1 rounded-full bg-coral px-4 py-2.5 font-display text-sm font-semibold text-paper transition hover:bg-[#e55a3c] disabled:opacity-60"
      >
        {isPending ? 'Sending…' : 'Send reset link'}
      </button>
    </form>
  );
}
