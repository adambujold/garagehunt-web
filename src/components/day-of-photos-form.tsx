"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  deleteListingPhoto,
  fetchDayOfPhotos,
  MAX_LISTING_PHOTOS,
  preparePickedPhoto,
  uploadListingPhoto,
  type UploadedPhoto,
} from "@/lib/listing-photos-upload";

// The seller-facing add-photos screen the day-of reminder deep-links to.
// Uploads immediately on selection (the listing already exists — unlike List
// a Sale's deferred batch), tagging every upload photo_type='day_of'. Those
// then lead the gallery/thumbnail and light up the "📸 Fresh Photos" badge on
// Discover + Sale Detail for the rest of today (all derived at render time in
// lib/listings.ts). RLS scopes the underlying insert/delete to this listing's
// own seller, so the browser client is safe here.
export function DayOfPhotosForm({ listingId, listingTitle }: { listingId: string; listingTitle: string }) {
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchDayOfPhotos(listingId)
      .then((existing) => {
        if (!cancelled) setPhotos(existing);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load your photos. Please refresh.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [listingId]);

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    const remaining = MAX_LISTING_PHOTOS - photos.length;
    if (remaining <= 0) {
      setError(`You can add up to ${MAX_LISTING_PHOTOS} photos.`);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      // sort_order well above the planning photos (0..n) so once today's
      // freshness expires these trail the original gallery rather than
      // interleaving with it (mirrors the mobile day-of screen).
      let sortOrder = 1000 + photos.length;
      for (const file of files.slice(0, remaining)) {
        const prepared = await preparePickedPhoto(file);
        try {
          const uploaded = await uploadListingPhoto(listingId, prepared, sortOrder, "day_of");
          // Newest first, matching the gallery's "most recent day_of leads".
          setPhotos((prev) => [uploaded, ...prev]);
          sortOrder += 1;
        } finally {
          URL.revokeObjectURL(prepared.previewUrl);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "That photo could not be added. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(photo: UploadedPhoto) {
    setDeletingId(photo.id);
    setError(null);
    try {
      await deleteListingPhoto(photo.id, photo.storageKey);
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove that photo.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:px-6">
      <h1 className="font-display text-2xl font-semibold text-ink">Your sale is starting! 📸</h1>
      <p className="mt-2 text-sm text-muted">
        Snap a fresh photo of <span className="font-medium text-ink">{listingTitle}</span> now — tables set up,
        everything laid out — to pull in more buyers today. These are added alongside your original photos and lead
        your listing with a <span className="font-medium text-ink">📸 Fresh Photos</span> badge for the rest of the
        day.
      </p>

      <div className="mt-6">
        <p className="text-sm font-medium text-ink">
          Today&apos;s photos ({photos.length}/{MAX_LISTING_PHOTOS})
        </p>
        {error && <p className="mt-2 rounded-lg bg-error-bg px-3 py-2 text-sm text-error-text">{error}</p>}

        {loading ? (
          <p className="mt-3 text-sm text-muted">Loading your photos…</p>
        ) : (
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="relative aspect-square overflow-hidden rounded-xl border-2 border-tan-border bg-amber-bg"
              >
                <Image src={photo.url} alt="" fill sizes="120px" className="object-cover" />
                {photo.moderationStatus !== "approved" && (
                  <span className="absolute inset-x-0 bottom-0 bg-black/55 px-1 py-0.5 text-center text-[10px] text-white">
                    In review
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleRemove(photo)}
                  disabled={deletingId === photo.id}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white"
                  aria-label="Remove photo"
                >
                  {deletingId === photo.id ? "…" : "×"}
                </button>
              </div>
            ))}
            {photos.length < MAX_LISTING_PHOTOS && (
              <label className="flex aspect-square cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-tan-border text-2xl text-muted hover:border-coral">
                {busy ? "…" : "+"}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFilesSelected}
                  disabled={busy}
                />
              </label>
            )}
          </div>
        )}
      </div>

      <div className="mt-8 flex items-center gap-4">
        <Link
          href={`/sale/${listingId}`}
          className="rounded-xl bg-coral px-5 py-2.5 text-sm font-semibold text-paper transition hover:opacity-90"
        >
          {photos.length > 0 ? "Done" : "Not now"}
        </Link>
        <Link href={`/sale/${listingId}`} className="text-sm text-muted underline underline-offset-2 hover:text-ink">
          View my listing
        </Link>
      </div>
    </div>
  );
}
