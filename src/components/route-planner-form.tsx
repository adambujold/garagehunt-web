'use client';

import { useEffect, useRef, useState } from 'react';

import { RouteMap } from '@/components/route-map';
import { getFavoritedListings } from '@/lib/favorited-listings';
import { buildGoogleMapsUrl } from '@/lib/google-maps-link';
import type { Listing } from '@/lib/listings';
import {
  type AddressSuggestion,
  type Coordinates,
  createSearchSessionToken,
  retrieveAddress,
  suggestAddresses,
} from '@/lib/mapbox-address-search';
import { getOptimizedRoute, type OptimizedRoute } from '@/lib/mapbox-directions';
import { emailRouteDirections } from '@/lib/route-email';
import {
  AUTO_SUGGEST_STOP_COUNT,
  RADIUS_OPTIONS_KM,
  fetchScoredCandidates,
  nextBestAlternative,
  type AutoSuggestWindow,
  type ScoredListing,
} from '@/lib/route-suggestions';

type Mode = 'manual' | 'auto';

const WINDOW_LABELS: Record<AutoSuggestWindow, string> = {
  today: 'Today',
  weekend: 'This weekend',
  next7days: 'Next 7 days',
};

export function RoutePlannerForm({ userId }: { userId: string }) {
  const [mode, setMode] = useState<Mode>('manual');

  // Origin — tries browser geolocation first, falls back to a typed address.
  const [origin, setOrigin] = useState<Coordinates | null>(null);
  const [originLabel, setOriginLabel] = useState('');
  const [geoDenied, setGeoDenied] = useState(false);
  const [addressInput, setAddressInput] = useState('');
  const [isAddressFocused, setIsAddressFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const sessionTokenRef = useRef(createSearchSessionToken());

  // Manual pick
  const [favorites, setFavorites] = useState<Listing[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Auto-suggest
  const [radiusKm, setRadiusKm] = useState(10);
  const [window, setWindowValue] = useState<AutoSuggestWindow>('weekend');
  const [candidates, setCandidates] = useState<ScoredListing[]>([]);
  const [stopIds, setStopIds] = useState<string[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  // Route result
  const [routeResult, setRouteResult] = useState<{ route: OptimizedRoute; stops: Listing[] } | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  // Actions
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoDenied(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setOriginLabel('Your current location');
      },
      () => setGeoDenied(true),
      { timeout: 8000 }
    );
  }, []);

  useEffect(() => {
    getFavoritedListings(userId)
      .then((listings) => {
        setFavorites(listings);
        setSelectedIds(listings.map((l) => l.id));
      })
      .catch((err) => console.error('Failed to load favorites', err))
      .finally(() => setFavoritesLoading(false));
  }, [userId]);

  useEffect(() => {
    if (!isAddressFocused) return;
    const trimmed = addressInput.trim();
    if (trimmed.length < 3) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      suggestAddresses(trimmed, sessionTokenRef.current, origin ?? undefined)
        .then(setSuggestions)
        .catch(() => setSuggestions([]));
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressInput, isAddressFocused]);

  async function handleSelectSuggestion(suggestion: AddressSuggestion) {
    try {
      const result = await retrieveAddress(suggestion.id, sessionTokenRef.current);
      setAddressInput(result.address);
      setOrigin(result.coordinates);
      setOriginLabel(result.address);
      setSuggestions([]);
      setIsAddressFocused(false);
      sessionTokenRef.current = createSearchSessionToken();
    } catch {
      setSuggestions([]);
    }
  }

  function toggleFavorite(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSuggest() {
    if (!origin) return;
    setSuggestLoading(true);
    setSuggestError(null);
    try {
      const scored = await fetchScoredCandidates(origin, radiusKm, window, userId);
      setCandidates(scored);
      setStopIds(scored.slice(0, AUTO_SUGGEST_STOP_COUNT).map((sale) => sale.id));
    } catch (err) {
      setSuggestError(err instanceof Error ? err.message : 'Could not suggest a route right now.');
    } finally {
      setSuggestLoading(false);
    }
  }

  function handleSwapStop(stopId: string) {
    const alternative = nextBestAlternative(candidates, stopIds);
    if (!alternative) return;
    setStopIds((current) => current.map((id) => (id === stopId ? alternative.id : id)));
  }

  async function handlePlanRoute() {
    if (!origin) return;
    const activeStops: Listing[] =
      mode === 'manual'
        ? favorites.filter((f) => selectedIds.includes(f.id))
        : candidates.filter((c) => stopIds.includes(c.id));

    if (activeStops.length === 0) {
      setRouteError(mode === 'manual' ? 'Select at least one favorite to route through.' : 'Suggest a route first.');
      return;
    }

    setRouteLoading(true);
    setRouteError(null);
    setEmailSent(false);
    try {
      const route = await getOptimizedRoute(origin, activeStops);
      setRouteResult({ route, stops: activeStops });
    } catch (err) {
      setRouteError(err instanceof Error ? err.message : 'Could not plan a route between these stops.');
    } finally {
      setRouteLoading(false);
    }
  }

  const orderedStops = routeResult
    ? routeResult.route.orderedStopIndexes.map((i) => routeResult.stops[i])
    : [];

  async function handleEmailRoute() {
    if (!origin || orderedStops.length === 0) return;
    setEmailSending(true);
    setEmailError(null);
    try {
      await emailRouteDirections(
        orderedStops.map((s) => ({ id: s.id, title: s.title, addressLabel: s.addressLabel })),
        originLabel
      );
      setEmailSent(true);
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Could not email your route right now.');
    } finally {
      setEmailSending(false);
    }
  }

  async function handleShareRoute() {
    if (orderedStops.length === 0) return;
    const stopLines = orderedStops
      .map((stop, i) => `${i + 1}. ${stop.title} — https://garagehunt.ca/sale/${stop.id}`)
      .join('\n');
    const message = `Come hunt with me this Saturday! 🔥\n\n${stopLines}`;

    if (navigator.share) {
      try {
        await navigator.share({ text: message });
      } catch {
        // User cancelled the share sheet — not an error.
      }
      return;
    }

    await navigator.clipboard.writeText(message);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <h1 className="font-display text-2xl font-semibold text-ink">Plan your route</h1>

      <div className="mt-4">
        {!origin && !geoDenied && <p className="text-sm text-muted">Getting your location…</p>}
        {!origin && geoDenied && (
          <div className="relative">
            <label className="flex flex-col gap-1 text-sm font-medium text-ink">
              Start from this address
              <input
                value={addressInput}
                onChange={(e) => setAddressInput(e.target.value)}
                onFocus={() => setIsAddressFocused(true)}
                onBlur={() => setTimeout(() => setIsAddressFocused(false), 150)}
                placeholder="Start typing an address…"
                className="rounded-xl border-2 border-tan-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-coral"
              />
            </label>
            {suggestions.length > 0 && (
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
        )}
        {origin && <p className="text-sm text-muted">Starting from {originLabel}</p>}
      </div>

      <div className="mt-4 flex gap-2">
        {(['manual', 'auto'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-full border-2 px-4 py-2 text-sm font-semibold transition ${
              mode === m ? 'border-coral bg-coral text-paper' : 'border-tan-border bg-white text-ink hover:border-ink'
            }`}
          >
            {m === 'manual' ? 'Manual pick' : 'Auto-suggest'}
          </button>
        ))}
      </div>

      {mode === 'manual' && (
        <div className="mt-4 flex flex-col gap-2">
          {favoritesLoading && <p className="text-sm text-muted">Loading your favorites…</p>}
          {!favoritesLoading && favorites.length === 0 && (
            <p className="rounded-2xl border-2 border-dashed border-tan-border bg-paper p-6 text-center text-sm text-muted">
              You haven&apos;t favorited any sales yet — favorite some on Discover first.
            </p>
          )}
          {favorites.map((sale) => (
            <label
              key={sale.id}
              className="flex items-center gap-3 rounded-xl border-2 border-tan-border bg-paper p-3 text-sm text-ink"
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(sale.id)}
                onChange={() => toggleFavorite(sale.id)}
                className="h-4 w-4"
              />
              <span className="flex-1 truncate font-medium">{sale.title}</span>
              <span className="text-xs text-muted">{sale.addressLabel}</span>
            </label>
          ))}
        </div>
      )}

      {mode === 'auto' && (
        <div className="mt-4 flex flex-col gap-4">
          {suggestError && <p className="rounded-lg bg-error-bg px-3 py-2 text-sm text-error-text">{suggestError}</p>}

          <div>
            <p className="text-sm font-medium text-ink">Radius</p>
            <div className="mt-2 flex gap-2">
              {RADIUS_OPTIONS_KM.map((km) => (
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

          <div>
            <p className="text-sm font-medium text-ink">When</p>
            <div className="mt-2 flex gap-2">
              {(Object.keys(WINDOW_LABELS) as AutoSuggestWindow[]).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWindowValue(w)}
                  className={`rounded-full border-2 px-3 py-1.5 text-sm transition ${
                    window === w ? 'border-coral bg-coral text-paper' : 'border-tan-border bg-white text-ink hover:border-ink'
                  }`}
                >
                  {WINDOW_LABELS[w]}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleSuggest}
            disabled={!origin || suggestLoading}
            className="self-start rounded-full bg-coral px-4 py-2.5 font-display text-sm font-semibold text-paper transition hover:bg-[#e55a3c] disabled:opacity-60"
          >
            {suggestLoading ? 'Suggesting…' : 'Suggest a route'}
          </button>

          {stopIds.length > 0 && (
            <div className="flex flex-col gap-2">
              {stopIds.map((id) => {
                const candidate = candidates.find((c) => c.id === id);
                if (!candidate) return null;
                return (
                  <div
                    key={id}
                    className="flex items-center gap-3 rounded-xl border-2 border-tan-border bg-paper p-3 text-sm text-ink"
                  >
                    <span className="flex-1 truncate font-medium">{candidate.title}</span>
                    {candidate.isMatched && (
                      <span className="rounded-full bg-amber-bg px-2 py-0.5 text-xs text-amber-text">Matched</span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleSwapStop(id)}
                      className="text-xs font-medium text-muted underline underline-offset-2 hover:text-ink"
                    >
                      Swap
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {routeError && <p className="mt-4 rounded-lg bg-error-bg px-3 py-2 text-sm text-error-text">{routeError}</p>}

      <button
        type="button"
        onClick={handlePlanRoute}
        disabled={!origin || routeLoading}
        className="mt-4 rounded-full bg-coral px-4 py-2.5 font-display text-sm font-semibold text-paper transition hover:bg-[#e55a3c] disabled:opacity-60"
      >
        {routeLoading ? 'Planning…' : 'Plan route'}
      </button>

      {routeResult && origin && (
        <div className="mt-6 flex flex-col gap-4">
          <div className="h-72 overflow-hidden rounded-2xl border-2 border-tan-border">
            <RouteMap origin={origin} stops={orderedStops} geometry={routeResult.route.geometry} />
          </div>

          <p className="text-sm text-muted">
            {(routeResult.route.distanceMeters / 1000).toFixed(1)} km · {Math.round(routeResult.route.durationSeconds / 60)} min
          </p>

          <ol className="flex flex-col gap-2">
            {orderedStops.map((stop, i) => (
              <li key={stop.id} className="flex items-center gap-3 rounded-xl border-2 border-tan-border bg-paper p-3 text-sm text-ink">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-coral text-xs font-bold text-paper">
                  {i + 1}
                </span>
                <span className="flex-1 truncate font-medium">{stop.title}</span>
                <span className="text-xs text-muted">{stop.addressLabel}</span>
              </li>
            ))}
          </ol>

          <div className="flex flex-wrap gap-2">
            <a
              href={buildGoogleMapsUrl(origin, orderedStops)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border-2 border-tan-border bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-coral"
            >
              Open in Google Maps
            </a>
            <button
              type="button"
              onClick={handleEmailRoute}
              disabled={emailSending}
              className="rounded-full border-2 border-tan-border bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-coral disabled:opacity-60"
            >
              {emailSending ? 'Sending…' : emailSent ? 'Emailed ✓' : 'Email me these directions'}
            </button>
            <button
              type="button"
              onClick={handleShareRoute}
              className="rounded-full border-2 border-tan-border bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-coral"
            >
              {shareCopied ? 'Copied ✓' : 'Share my route'}
            </button>
          </div>
          {emailError && <p className="rounded-lg bg-error-bg px-3 py-2 text-sm text-error-text">{emailError}</p>}
        </div>
      )}
    </div>
  );
}
