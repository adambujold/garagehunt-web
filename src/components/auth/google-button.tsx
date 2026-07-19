import { signInWithGoogle } from '@/app/auth/actions';

// No 'use client' needed — this is a plain server-rendered form pointed at
// a Server Action. Google's OAuth screen is the whole point of the
// redirect, so there's no useful pending/error state to show inline the
// way the email/password forms need.
export function GoogleButton({ redirectTo }: { redirectTo: string }) {
  return (
    <form action={signInWithGoogle}>
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <button
        type="submit"
        className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-tan-border bg-paper px-4 py-2.5 font-display text-sm font-semibold text-ink transition hover:border-ink"
      >
        <GoogleMark className="h-4 w-4" />
        Continue with Google
      </button>
    </form>
  );
}

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.47c-.28 1.5-1.13 2.77-2.4 3.62v3h3.87c2.27-2.09 3.55-5.17 3.55-8.65z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3c-1.08.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.09C3.24 21.3 7.29 24 12 24z"
      />
      <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.37-2.28V6.63H1.27A11.98 11.98 0 0 0 0 12c0 1.94.46 3.77 1.27 5.37z" />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.94 1.19 15.24 0 12 0 7.29 0 3.24 2.7 1.27 6.63l4 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}
