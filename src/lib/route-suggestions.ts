import { haversineDistanceKm } from '@/lib/haversine';
import type { Coordinates } from '@/lib/mapbox-address-search';
import { getPublishedListings, type Listing } from '@/lib/listings';
import { fetchMySavedSearch } from '@/lib/saved-searches';

// Ported from the mobile app's utils/route-suggestions.ts — Auto-Suggest
// turned out to be 100% client-side there (no RPC/Edge Function at all,
// despite the architecture doc implying a server-side scoring API), so
// this is a direct port of that same in-memory scoring, not a redesign.

export type AutoSuggestWindow = 'today' | 'weekend' | 'next7days';

export const RADIUS_OPTIONS_KM = [5, 10, 20, 50] as const;

export const AUTO_SUGGEST_STOP_COUNT = 5;

const SCORE_WEIGHTS = {
  proximityPerKm: 1,
  categoryMatch: 8,
  favoritePerCount: 0.15,
  // The website has no seller-rating data yet (reviews aren't built here) —
  // this term is always 0 until that lands, same graceful-degradation
  // philosophy as a missing saved search below.
  ratingPerStar: 2,
} as const;

export type ScoredListing = Listing & { distanceKm: number; score: number; isMatched: boolean };

function parseDateOnly(dateStr: string, endOfDay = false): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return endOfDay ? new Date(year, month - 1, day, 23, 59, 59, 999) : new Date(year, month - 1, day);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function saleOverlapsRange(sale: Pick<Listing, 'startDate' | 'endDate'>, rangeStart: Date, rangeEnd: Date): boolean {
  const saleStart = parseDateOnly(sale.startDate);
  const saleEnd = parseDateOnly(sale.endDate, true);
  return saleStart <= rangeEnd && saleEnd >= rangeStart;
}

function matchesToday(sale: Pick<Listing, 'startDate' | 'endDate'>, now: Date): boolean {
  const start = startOfDay(now);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59, 59, 999);
  return saleOverlapsRange(sale, start, end);
}

function getWeekendRange(now: Date): { start: Date; end: Date } {
  const day = now.getDay();
  const daysUntilSaturday = day === 0 ? -1 : 6 - day;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilSaturday);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1, 23, 59, 59, 999);
  return { start, end };
}

function matchesThisWeekend(sale: Pick<Listing, 'startDate' | 'endDate'>, now: Date): boolean {
  const { start, end } = getWeekendRange(now);
  return saleOverlapsRange(sale, start, end);
}

function matchesNext7Days(sale: Pick<Listing, 'startDate' | 'endDate'>, now: Date): boolean {
  const start = startOfDay(now);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);
  return saleOverlapsRange(sale, start, end);
}

function windowPredicate(window: AutoSuggestWindow) {
  if (window === 'today') return matchesToday;
  if (window === 'weekend') return matchesThisWeekend;
  return matchesNext7Days;
}

function scoreSale(sale: Listing, distanceKm: number, radiusKm: number, interestCategories: string[]): ScoredListing {
  const proximityScore = Math.max(0, radiusKm - distanceKm) * SCORE_WEIGHTS.proximityPerKm;
  const matchCount =
    interestCategories.length > 0 ? sale.categories.filter((category) => interestCategories.includes(category)).length : 0;
  const qualityScore = sale.favoriteCount * SCORE_WEIGHTS.favoritePerCount;

  return {
    ...sale,
    distanceKm,
    score: proximityScore + matchCount * SCORE_WEIGHTS.categoryMatch + qualityScore,
    isMatched: matchCount > 0,
  };
}

// Returns every in-radius, in-window candidate, scored and sorted highest
// first — the full list, not just the top N, so swapping a stop can pull
// the next-best alternative straight out of it (nextBestAlternative below)
// instead of re-querying — mirrors mobile's "not a full re-run" swap.
export async function fetchScoredCandidates(
  origin: Coordinates,
  radiusKm: number,
  window: AutoSuggestWindow,
  userId: string
): Promise<ScoredListing[]> {
  const [allListings, savedSearch] = await Promise.all([
    getPublishedListings(),
    fetchMySavedSearch(userId).catch(() => null),
  ]);

  const interestCategories = savedSearch?.categoryNames ?? [];
  const predicate = windowPredicate(window);
  const now = new Date();

  return allListings
    .map((sale) => ({ sale, distanceKm: haversineDistanceKm(origin, sale) }))
    .filter(({ sale, distanceKm }) => distanceKm <= radiusKm && predicate(sale, now))
    .map(({ sale, distanceKm }) => scoreSale(sale, distanceKm, radiusKm, interestCategories))
    .sort((a, b) => b.score - a.score);
}

export function nextBestAlternative(candidates: ScoredListing[], currentStopIds: string[]): ScoredListing | null {
  return candidates.find((candidate) => !currentStopIds.includes(candidate.id)) ?? null;
}
