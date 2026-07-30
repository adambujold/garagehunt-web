'use client';

import { useActionState } from 'react';

import { updatePassword } from '@/app/auth/actions';

const inputClass =
  'w-full rounded-xl border-2 border-tan-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-coral';

export function ResetPasswordForm() {
  const [state, formAction, isPending] = useActionState(updatePassword, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state?.error && (
        <p className="rounded-lg bg-error-bg px-3 py-2 text-sm text-error-text">{state.error}</p>
      )}

      <label className="flex flex-col gap-1 text-sm font-medium text-ink">
        New password
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={8}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-ink">
        Confirm new password
        <input
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          required
          minLength={8}
          className={inputClass}
        />
      </label>

      <p className="text-xs text-muted">At least 8 characters.</p>

      <button
        type="submit"
        disabled={isPending}
        className="mt-1 rounded-full bg-coral px-4 py-2.5 font-display text-sm font-semibold text-paper transition hover:bg-[#e55a3c] disabled:opacity-60"
      >
        {isPending ? 'Saving…' : 'Set new password'}
      </button>
    </form>
  );
}
