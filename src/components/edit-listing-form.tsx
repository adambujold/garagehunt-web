"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { PaymentMethodToggle } from "@/components/list-a-sale/payment-method-toggle";
import { CATEGORIES } from "@/lib/categories";
import {
  deleteListingPhoto,
  fetchListingPhotos,
  MAX_LISTING_PHOTOS,
  preparePickedPhoto,
  uploadListingPhoto,
  type UploadedPhoto,
} from "@/lib/listing-photos-upload";
import type { EditableListing } from "@/lib/my-listings";
import { cancelSaleListing, updateSaleListing, type PaymentMethod } from "@/lib/sale-listings-write";

// Web equivalent of the app's edit-listing/[id].tsx. The website could create
// listings but never edit them, which the feature spec calls out as mattering
// in practice — a two-day sale often needs updating between days.
//
// Photos upload immediately on selection (the listing already has an id),
// unlike List a Sale's deferred batch. Address is display-only: locked after
// publish per the architecture doc.
export function EditListingForm({ listing }: { listing: EditableListing }) {
  const router = useRouter();

  const [startDate, setStartDate] = useState(listing.startDate);
  const [endDate, setEndDate] = useState(listing.endDate);
  const [title, setTitle] = useState(listing.title);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(listing.paymentMethod);
  const [description, setDescription] = useState(listing.description);
  const [categories, setCategories] = useState<string[]>(listing.categoryNames);
  const [otherItems, setOtherItems] = useState<string[]>(listing.otherItems);
  const [otherDraft, setOtherDraft] = useState("");

  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(true);
  const [pickingPhoto, setPickingPhoto] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchListingPhotos(listing.id, "planning", { column: "sort_order", ascending: true })
      .then((existing) => {
        if (!cancelled) setPhotos(existing);
      })
      .catch(() => {
        if (!cancelled) setPhotoError("Couldn't load your photos. Please refresh.");
      })
      .finally(() => {
        if (!cancelled) setPhotosLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [listing.id]);

  function toggleCategory(category: string) {
    setCategories((prev) => {
      const active = prev.includes(category);
      if (active && category === "Other") setOtherItems([]);
      return active ? prev.filter((c) => c !== category) : [...prev, category];
    });
  }

  function handleAddOtherItem(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const trimmed = otherDraft.trim();
    if (trimmed) setOtherItems((prev) => [...prev, trimmed]);
    setOtherDraft("");
  }

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    const remaining = MAX_LISTING_PHOTOS - photos.length;
    if (remaining <= 0) {
      setPhotoError(`You can add up to ${MAX_LISTING_PHOTOS} photos.`);
      return;
    }

    setPickingPhoto(true);
    setPhotoError(null);
    try {
      let sortOrder = photos.length;
      for (const file of files.slice(0, remaining)) {
        const prepared = await preparePickedPhoto(file);
        try {
          const uploaded = await uploadListingPhoto(listing.id, prepared, sortOrder, "planning");
          setPhotos((prev) => [...prev, uploaded]);
          sortOrder += 1;
        } finally {
          URL.revokeObjectURL(prepared.previewUrl);
        }
      }
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "That photo could not be added.");
    } finally {
      setPickingPhoto(false);
    }
  }

  async function handleRemovePhoto(photo: UploadedPhoto) {
    setPhotoError(null);
    setDeletingId(photo.id);
    try {
      await deleteListingPhoto(photo.id, photo.storageKey);
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Could not remove that photo.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSave() {
    setSaveError(null);
    setSaving(true);
    try {
      await updateSaleListing({
        id: listing.id,
        startDate,
        endDate,
        title,
        paymentMethod,
        description,
        otherItems,
        categoryNames: categories,
        // A draft's save doubles as its publish, same as the app.
        publish: listing.isDraft,
      });
      router.push("/my-listings");
      router.refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Something went wrong saving your changes.");
      setSaving(false);
    }
  }

  async function handleCancelListing() {
    setCancelling(true);
    try {
      await cancelSaleListing(listing.id);
      router.push("/my-listings");
      router.refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Something went wrong cancelling this sale.");
      setCancelling(false);
      setConfirmingCancel(false);
    }
  }

  if (listing.isCancelled) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center sm:px-6">
        <h1 className="font-display text-2xl font-semibold text-ink">This sale was cancelled</h1>
        <p className="mt-2 text-sm text-muted">A cancelled sale can no longer be edited.</p>
        <Link
          href="/my-listings"
          className="mt-6 inline-block rounded-full border-2 border-tan-border bg-white px-4 py-2 text-sm font-medium text-ink hover:border-coral"
        >
          Back to My Listings
        </Link>
      </div>
    );
  }

  const inputClass =
    "rounded-xl border-2 border-tan-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-coral";

  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:px-6">
      <Link href="/my-listings" className="text-sm text-muted underline underline-offset-2 hover:text-ink">
        ← Back to My Listings
      </Link>
      <h1 className="mt-3 font-display text-2xl font-semibold text-ink">
        {listing.isDraft ? "Finish your listing" : "Edit listing"}
      </h1>

      <div className="mt-6 flex flex-col gap-5">
        <div>
          <p className="text-sm font-medium text-ink">
            Photos ({photos.length}/{MAX_LISTING_PHOTOS})
          </p>
          {photoError && (
            <p className="mt-1 rounded-lg bg-error-bg px-3 py-2 text-sm text-error-text">{photoError}</p>
          )}
          {photosLoading ? (
            <p className="mt-2 text-sm text-muted">Loading photos…</p>
          ) : (
            <div className="mt-2 grid grid-cols-4 gap-2">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="relative aspect-square overflow-hidden rounded-xl border-2 border-tan-border bg-amber-bg"
                >
                  <Image src={photo.url} alt="" fill sizes="100px" className="object-cover" />
                  {photo.moderationStatus !== "approved" && (
                    <span className="absolute inset-x-0 bottom-0 bg-black/55 px-1 py-0.5 text-center text-[10px] text-white">
                      In review
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(photo)}
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
                  {pickingPhoto ? "…" : "+"}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleFilesSelected}
                    disabled={pickingPhoto}
                  />
                </label>
              )}
            </div>
          )}
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
              className={inputClass}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-ink">
            End date
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        <p className="-mt-3 text-xs text-muted">
          Extend or shorten anytime — pushing the end date past today makes the sale live again.
        </p>

        <div>
          <p className="text-sm font-medium text-ink">Address</p>
          <p className="mt-1 flex items-center gap-2 rounded-xl border-2 border-tan-border bg-tan/60 px-3 py-2 text-sm text-muted-dark">
            🔒 {listing.addressText}
          </p>
          <p className="mt-1 text-xs text-muted">
            Address is locked after publishing. Need to fix an error? Contact support.
          </p>
        </div>

        <div>
          <p className="text-sm font-medium text-ink">Categories</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => toggleCategory(c)}
                className={`rounded-full border-2 px-3 py-1.5 text-sm transition ${
                  categories.includes(c)
                    ? "border-coral bg-coral text-paper"
                    : "border-tan-border bg-white text-ink hover:border-ink"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {categories.includes("Other") && (
          <div>
            <label className="flex flex-col gap-1 text-sm font-medium text-ink">
              What else are you bringing?
              <input
                value={otherDraft}
                onChange={(e) => setOtherDraft(e.target.value)}
                onKeyDown={handleAddOtherItem}
                placeholder="Type an item and press Enter"
                className={inputClass}
              />
            </label>
            {otherItems.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {otherItems.map((item, i) => (
                  <span
                    key={`${item}-${i}`}
                    className="flex items-center gap-1 rounded-full bg-amber-bg px-3 py-1 text-sm text-amber-text"
                  >
                    {item}
                    <button
                      type="button"
                      onClick={() => setOtherItems((prev) => prev.filter((_, idx) => idx !== i))}
                      aria-label={`Remove ${item}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Title (optional)
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Auto-generated from your address if left blank"
            className={inputClass}
          />
        </label>

        <div>
          <p className="text-sm font-medium text-ink">Payment method</p>
          <div className="mt-2">
            <PaymentMethodToggle value={paymentMethod} onChange={setPaymentMethod} />
          </div>
        </div>

        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Description (optional)
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Moving sale, everything must go!"
            className={inputClass}
          />
        </label>

        {saveError && <p className="rounded-lg bg-error-bg px-3 py-2 text-sm text-error-text">{saveError}</p>}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || cancelling}
          className="rounded-xl bg-coral px-5 py-3 text-sm font-semibold text-paper transition hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "Saving…" : listing.isDraft ? "Publish sale" : "Save changes"}
        </button>

        {!confirmingCancel ? (
          <button
            type="button"
            onClick={() => setConfirmingCancel(true)}
            disabled={saving || cancelling}
            className="self-center text-sm font-medium text-error-text underline underline-offset-2"
          >
            Cancel this sale
          </button>
        ) : (
          <div className="rounded-2xl border-2 border-tan-border bg-white p-4 text-center">
            <p className="text-sm font-medium text-ink">Cancel this sale? This can&apos;t be undone.</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmingCancel(false)}
                disabled={cancelling}
                className="flex-1 rounded-full border-2 border-tan-border bg-white px-3 py-2 text-sm font-medium text-ink"
              >
                Keep it
              </button>
              <button
                type="button"
                onClick={handleCancelListing}
                disabled={cancelling}
                className="flex-1 rounded-full bg-error-text px-3 py-2 text-sm font-medium text-paper disabled:opacity-60"
              >
                {cancelling ? "Cancelling…" : "Yes, cancel it"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
