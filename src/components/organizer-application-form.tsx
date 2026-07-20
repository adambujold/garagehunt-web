'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { submitOrganizerApplication } from '@/lib/organizer-applications';

export function OrganizerApplicationForm({ userId, initialFullName }: { userId: string; initialFullName: string }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initialFullName);
  const [neighborhood, setNeighborhood] = useState('');
  const [affiliationNotes, setAffiliationNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !neighborhood.trim() || !affiliationNotes.trim()) {
      setError('Please fill in every field before submitting.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await submitOrganizerApplication({
        userId,
        fullName: fullName.trim(),
        neighborhood: neighborhood.trim(),
        affiliationNotes: affiliationNotes.trim(),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong submitting your application.');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border-2 border-tan-border bg-paper p-5">
      {error && <p className="rounded-lg bg-error-bg px-3 py-2 text-sm text-error-text">{error}</p>}

      <label className="flex flex-col gap-1 text-sm font-medium text-ink">
        Your full name
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Your full name"
          className="rounded-xl border-2 border-tan-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-coral"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-ink">
        Neighborhood
        <input
          value={neighborhood}
          onChange={(e) => setNeighborhood(e.target.value)}
          placeholder="e.g. Riverdale, Old East Village"
          className="rounded-xl border-2 border-tan-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-coral"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-ink">
        Tell us about your connection to the neighborhood
        <textarea
          value={affiliationNotes}
          onChange={(e) => setAffiliationNotes(e.target.value)}
          rows={4}
          placeholder="Tell us about your connection to the neighborhood..."
          className="rounded-xl border-2 border-tan-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-coral"
        />
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-full bg-coral px-4 py-2.5 font-display text-sm font-semibold text-paper transition hover:bg-[#e55a3c] disabled:opacity-60"
      >
        {submitting ? 'Submitting…' : 'Submit application'}
      </button>
    </form>
  );
}
