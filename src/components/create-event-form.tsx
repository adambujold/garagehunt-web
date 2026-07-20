'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { ListingsMap } from '@/components/listings-map';
import {
  type AddressSuggestion,
  type Coordinates,
  createSearchSessionToken,
  retrieveAddress,
  suggestAddresses,
} from '@/lib/mapbox-address-search';
import { createTownWideEvent } from '@/lib/town-wide-events';

const RADIUS_PRESETS_KM = [0.5, 1, 2, 5];

export function CreateEventForm({ organizerId }: { organizerId: string }) {
  const router = useRouter();

  const [name, setName] = useState('');
  const [radiusKm, setRadiusKm] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [address, setAddress] = useState('');
  const [isAddressFocused, setIsAddressFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const sessionTokenRef = useRef(createSearchSessionToken());

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleAddressChange(value: string) {
    setAddress(value);
    setCoords(null);
    const trimmed = value.trim();
    if (trimmed.length < 3) {
      setSuggestions([]);
      return;
    }
    suggestAddresses(trimmed, sessionTokenRef.current)
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !startDate || !endDate) {
      setError('Please fill in every field before creating the event.');
      return;
    }
    if (!coords) {
      setError('Pick an address from the suggestions so we know where this event is centered.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const eventId = await createTownWideEvent({
        organizerId,
        name: name.trim(),
        centerLatitude: coords.latitude,
        centerLongitude: coords.longitude,
        radiusKm,
        startDate,
        endDate,
      });
      router.push(`/organizer-event/${eventId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong creating the event.');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border-2 border-tan-border bg-paper p-5">
      {error && <p className="rounded-lg bg-error-bg px-3 py-2 text-sm text-error-text">{error}</p>}

      <label className="flex flex-col gap-1 text-sm font-medium text-ink">
        Event name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Riverdale Community Garage Sale"
          className="rounded-xl border-2 border-tan-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-coral"
        />
      </label>

      <div className="relative">
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Center point
          <input
            value={address}
            onChange={(e) => handleAddressChange(e.target.value)}
            onFocus={() => setIsAddressFocused(true)}
            onBlur={() => setTimeout(() => setIsAddressFocused(false), 150)}
            placeholder="Start typing an address…"
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
          <ListingsMap listings={[{ id: 'center', title: name || address, ...coords }]} center={coords} zoom={13} />
        </div>
      )}

      <div>
        <p className="text-sm font-medium text-ink">Radius</p>
        <div className="mt-2 flex gap-2">
          {RADIUS_PRESETS_KM.map((km) => (
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
          Start date
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              if (!endDate || endDate < e.target.value) setEndDate(e.target.value);
            }}
            className="rounded-xl border-2 border-tan-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-coral"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-ink">
          End date
          <input
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-xl border-2 border-tan-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-coral"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-full bg-coral px-4 py-2.5 font-display text-sm font-semibold text-paper transition hover:bg-[#e55a3c] disabled:opacity-60"
      >
        {submitting ? 'Creating…' : 'Create event'}
      </button>
    </form>
  );
}
