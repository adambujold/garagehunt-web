'use client';

import { useEffect, useState } from 'react';

import { suggestListingCopy } from '@/lib/ai-suggestions';

export function AiSuggestionModal({
  open,
  categories,
  otherItems,
  onAccept,
  onClose,
}: {
  open: boolean;
  categories: string[];
  otherItems: string[];
  onAccept: (title: string, description: string) => void;
  onClose: () => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hasGenerated, setHasGenerated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPrompt('');
    setTitle('');
    setDescription('');
    setHasGenerated(false);
    setLoading(false);
    setError(null);
  }, [open]);

  if (!open) return null;

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const result = await suggestListingCopy({ categories, otherItems, prompt: prompt.trim() || undefined });
      setTitle(result.title);
      setDescription(result.description);
      setHasGenerated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate a suggestion right now.');
    } finally {
      setLoading(false);
    }
  }

  function handleUse() {
    onAccept(title.trim(), description.trim());
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border-2 border-tan-border bg-paper p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-lg font-semibold text-ink">✨ Get AI suggestions</h2>
        <p className="mt-1 text-sm text-muted">We&apos;ll write a title and description from your categories and items.</p>

        {error && <p className="mt-3 rounded-lg bg-error-bg px-3 py-2 text-sm text-error-text">{error}</p>}

        <label className="mt-3 flex flex-col gap-1 text-sm font-medium text-ink">
          Anything to mention? (optional)
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. moving sale, everything must go"
            className="rounded-xl border-2 border-tan-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-coral"
          />
        </label>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="mt-3 w-full rounded-full border-2 border-tan-border bg-white px-4 py-2 font-display text-sm font-semibold text-ink transition hover:border-coral disabled:opacity-60"
        >
          {loading ? 'Generating…' : hasGenerated ? 'Regenerate' : 'Generate suggestion'}
        </button>

        {hasGenerated && (
          <div className="mt-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium text-ink">
              Title
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="rounded-xl border-2 border-tan-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-coral"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-ink">
              Description
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="rounded-xl border-2 border-tan-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-coral"
              />
            </label>
            <button
              type="button"
              onClick={handleUse}
              className="rounded-full bg-coral px-4 py-2.5 font-display text-sm font-semibold text-paper hover:bg-[#e55a3c]"
            >
              Use this title &amp; description
            </button>
          </div>
        )}

        <button type="button" onClick={onClose} className="mt-3 w-full text-center text-sm text-muted underline underline-offset-2">
          Cancel
        </button>
      </div>
    </div>
  );
}
