'use client';

import { useActionState } from 'react';

import { register } from '@/app/auth/actions';
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from '@/lib/terms';

const inputClass =
  'w-full rounded-xl border-2 border-tan-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-coral';

export function RegisterForm({ redirectTo }: { redirectTo: string }) {
  const [state, formAction, isPending] = useActionState(register, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="redirectTo" value={redirectTo} />

      {state?.error && (
        <p className="rounded-lg bg-error-bg px-3 py-2 text-sm text-error-text">{state.error}</p>
      )}
      {state?.info && (
        <p className="rounded-lg bg-amber-bg px-3 py-2 text-sm text-amber-text">{state.info}</p>
      )}

      <label className="flex flex-col gap-1 text-sm font-medium text-ink">
        Email
        <input type="email" name="email" autoComplete="email" required className={inputClass} />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-ink">
        Password
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          minLength={8}
          required
          className={inputClass}
        />
      </label>

      <label className="flex items-start gap-2 text-xs text-muted">
        <input type="checkbox" name="acceptedTerms" required className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          I agree to GarageHunt&apos;s{' '}
          <a href={TERMS_OF_SERVICE_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-ink">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href={PRIVACY_POLICY_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-ink">
            Privacy Policy
          </a>
          .
        </span>
      </label>

      <button
        type="submit"
        disabled={isPending}
        className="mt-1 rounded-full bg-coral px-4 py-2.5 font-display text-sm font-semibold text-paper transition hover:bg-[#e55a3c] disabled:opacity-60"
      >
        {isPending ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  );
}
