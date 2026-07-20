'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { EventJoinRequest } from '@/lib/town-wide-events';
import { updateEventJoinRequestStatus } from '@/lib/town-wide-events';

export function JoinRequestActions({ request }: { request: EventJoinRequest }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDecision(status: 'approved' | 'denied') {
    setPending(true);
    setError(null);
    try {
      await updateEventJoinRequestStatus(request.id, status);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border-2 border-tan-border bg-paper p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{request.listingTitle ?? 'Untitled listing'}</p>
        <p className="truncate text-xs text-muted">{request.listingAddress}</p>
        {error && <p className="mt-1 text-xs text-error-text">{error}</p>}
      </div>
      <button
        type="button"
        onClick={() => handleDecision('approved')}
        disabled={pending}
        className="rounded-full bg-coral px-3 py-1.5 text-xs font-semibold text-paper transition hover:bg-[#e55a3c] disabled:opacity-60"
      >
        Approve
      </button>
      <button
        type="button"
        onClick={() => handleDecision('denied')}
        disabled={pending}
        className="rounded-full border-2 border-tan-border bg-white px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-ink disabled:opacity-60"
      >
        Deny
      </button>
    </div>
  );
}
