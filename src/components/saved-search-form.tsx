'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { ListingsMap } from '@/components/listings-map';
import { CATEGORIES } from '@/lib/categories';
import {
  type AddressSuggestion,
  type Coordinates,
  createSearchSessionToken,
  retrieveAddress,
  suggestAddresses,
} from '@/lib/mapbox-address-search';
import { backfillMatchesForSavedSearch } from '@/lib/matches';
import { saveSavedSearch, type SavedSearch } from '@/lib/saved-searches';

const RADII_KM = [5, 10, 20, 50];

export function SavedSearchForm({ userId, existing }: { userId: string; existing: SavedSearch | null }) {
  const router = useRouter();

  const [address, setAddress] = useState('');
  const [isAddressFocused, setIsAddressFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [coords, setCoords] = useState<Coordinates | null>(
    existing ? { latitude: existing.centerLatitude, longitude: existing.centerLongitude } : null
  );
  const sessionTokenRef = useRef(createSearchSessionToken());

  const [keywordsText, setKeywordsText] = useState(existing?.keywords.join(', ') ?? '');
  const [categories, setCategories] = useState<string[]>(existing?.categoryNames ?? ['Furniture']);
  const [radiusKm, setRadiusKm] = useState(existing?.radiusKm ?? 10);
  const [dateFrom, setDateFrom] = useState(existing?.dateFrom ?? '');
  const [dateTo, setDateTo] = useState(existing?.dateTo ?? '');
  const [notifyEnabled, setNotifyEnabled] = useState(existing?.notifyEnabled ?? true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedJustNow, setSavedJustNow] = useState(false);

  function handleAddressChange(value: string) {
    setAddress(value);
    setCoords(null);
    const trimmed = value.trim();
    if (trimmed.length < 3) {
      setSuggestions([]);
      return;
    }
    suggestAddresses(trimmed, sessionTokenRef.current, coords ?? undefined)
      .then(setSuggestions)
      .catch(() => setSuggestions([]));
  }

  async function handleSelectSuggestion(suggestion: AddressSuggestion) {
    try {
      const result = await retrieveAddress(suggestion.id, sessionTokenRef.current);
      setAddress(result.address);
      setCoords(result.coordinates);
      setSuggestions([]);
      setIsAddressFocused(false);
      sessionTokenRef.current = createSearchSessionToken();
    } catch {
      setSuggestions([]);
    }
  }

  function toggleCategory(name: string) {
    setCategories((prev) => (prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!coords) {
      setError('Pick an address from the suggestions so we know where to search near.');
      return;
    }

    setSaving(true);
    setError(null);
    setSavedJustNow(false);
    try {
      const keywords = keywordsText
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);

      const { id, categoryIds } = await saveSavedSearch({
        id: existing?.id,
        userId,
        keywords,
        categoryNames: categories,
        centerLatitude: coords.latitude,
        centerLongitude: coords.longitude,
        radiusKm,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        notifyEnabled,
      });

      try {
        await backfillMatchesForSavedSearch({ searchId: id, keywords, categoryIds });
      } catch (err) {
        console.error('Failed to backfill matches for saved search', err);
      }

      setSavedJustNow(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong saving your search.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border-2 border-tan-border bg-paper p-5">
      {error && <p className="rounded-lg bg-error-bg px-3 py-2 text-sm text-error-text">{error}</p>}
      {savedJustNow && !error && (
        <p className="rounded-lg bg-amber-bg px-3 py-2 text-sm text-amber-text">Saved — your matches are below.</p>
      )}

      <div className="relative">
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Search near this address
          <input
            value={address}
            onChange={(e) => handleAddressChange(e.target.value)}
            onFocus={() => setIsAddressFocused(true)}
            onBlur={() => setTimeout(() => setIsAddressFocused(false), 150)}
            placeholder={existing ? 'Update the address to move your search' : 'Start typing an address…'}
            className="rounded-xl border-2 border-tan-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-coral"
          />
        </label>
        {isAddressFocused && suggestions.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border-2 border-tan-border bg-white shadow-lg">
            {suggestions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onMouseDown={() => handleSelectSuggestion(s)}
                  className="block w-full px-3 py-2 text-left text-sm text-ink hover:bg-amber-bg"
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {coords && (
        <div className="h-40 overflow-hidden rounded-2xl border-2 border-tan-border">
          <ListingsMap listings={[{ id: 'center', title: address, ...coords }]} center={coords} zoom={11} />
        </div>
      )}

      <label className="flex flex-col gap-1 text-sm font-medium text-ink">
        Keywords
        <input
          value={keywordsText}
          onChange={(e) => setKeywordsText(e.target.value)}
          placeholder="kids bike, dining table…"
          className="rounded-xl border-2 border-tan-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-coral"
        />
        <span className="text-xs text-muted">Comma-separated — matched against listing descriptions and other items.</span>
      </label>

      <div>
        <p className="text-sm font-medium text-ink">Categories</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => toggleCategory(c)}
              className={`rounded-full border-2 px-3 py-1.5 text-sm transition ${
                categories.includes(c) ? 'border-coral bg-coral text-paper' : 'border-tan-border bg-white text-ink hover:border-ink'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-ink">Radius</p>
        <div className="mt-2 flex gap-2">
          {RADII_KM.map((km) => (
            <button
              key={km}
              type="button"
              onClick={() => setRadiusKm(km)}
              className={`rounded-full border-2 px-3 py-1.5 text-sm transition ${
                radiusKm === km ? 'border-coral bg-coral text-paper' : 'border-tan-border bg-white text-ink hover:border-ink'
              }`}
            >
              {km} km
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-ink">
          From (optional)
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-xl border-2 border-tan-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-coral"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-ink">
          To (optional)
          <input
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-xl border-2 border-tan-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-coral"
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" checked={notifyEnabled} onChange={(e) => setNotifyEnabled(e.target.checked)} className="h-4 w-4" />
        Notify me by push and email when a new sale matches
      </label>

      <button
        type="submit"
        disabled={saving}
        className="self-start rounded-full bg-coral px-4 py-2.5 font-display text-sm font-semibold text-paper transition hover:bg-[#e55a3c] disabled:opacity-60"
      >
        {saving ? 'Saving…' : existing ? 'Update search' : 'Save search'}
      </button>
    </form>
  );
}
