'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

import { AiSuggestionModal } from '@/components/list-a-sale/ai-suggestion-modal';
import { PaymentMethodToggle } from '@/components/list-a-sale/payment-method-toggle';
import { ListingsMap } from '@/components/listings-map';
import { CATEGORIES } from '@/lib/categories';
import {
  type AddressSuggestion,
  type Coordinates,
  createSearchSessionToken,
  retrieveAddress,
  suggestAddresses,
} from '@/lib/mapbox-address-search';
import { geocodeAddress } from '@/lib/mapbox-geocoding';
import {
  MAX_LISTING_PHOTOS,
  type PendingPhoto,
  preparePickedPhoto,
  uploadPendingPhotos,
} from '@/lib/listing-photos-upload';
import { createSaleListing, publishSaleListing, type PaymentMethod } from '@/lib/sale-listings-write';
import { findNearbyEvent, submitEventJoinRequest, fetchEventParticipantCount, type NearbyTownWideEvent } from '@/lib/town-wide-events';

const TOTAL_STEPS = 4;
type JoinEventStatus = 'undecided' | 'requested' | 'declined';

export function ListASaleForm({ userId }: { userId: string }) {
  const [step, setStep] = useState(1);

  // Step 1 — address & schedule
  const [address, setAddress] = useState('');
  const [isAddressFocused, setIsAddressFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [selectedCoords, setSelectedCoords] = useState<Coordinates | null>(null);
  const sessionTokenRef = useRef(createSearchSessionToken());
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('14:00');
  const [showExactAddress, setShowExactAddress] = useState(false);

  // Step 2 — details
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [pickingPhoto, setPickingPhoto] = useState(false);
  const [categories, setCategories] = useState<string[]>(['Furniture']);
  const [otherItems, setOtherItems] = useState<string[]>([]);
  const [otherDraft, setOtherDraft] = useState('');
  const [title, setTitle] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash_only');
  const [description, setDescription] = useState('');
  const [aiModalOpen, setAiModalOpen] = useState(false);

  // Step 3 — town-wide event
  const [joinEventStatus, setJoinEventStatus] = useState<JoinEventStatus>('undecided');
  const [matchedEvent, setMatchedEvent] = useState<NearbyTownWideEvent | null | undefined>(undefined);
  const [eventParticipantCount, setEventParticipantCount] = useState(0);

  // Publish
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishedListingId, setPublishedListingId] = useState<string | null>(null);

  // Debounced address autocomplete — min 3 chars, 300ms, mirrors mobile.
  useEffect(() => {
    if (!isAddressFocused) return;
    const trimmed = address.trim();
    if (trimmed.length < 3) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      suggestAddresses(trimmed, sessionTokenRef.current, selectedCoords ?? undefined)
        .then(setSuggestions)
        .catch(() => setSuggestions([]));
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, isAddressFocused]);

  async function handleSelectSuggestion(suggestion: AddressSuggestion) {
    try {
      const result = await retrieveAddress(suggestion.id, sessionTokenRef.current);
      setAddress(result.address);
      setSelectedCoords(result.coordinates);
      setSuggestions([]);
      setIsAddressFocused(false);
      sessionTokenRef.current = createSearchSessionToken();
    } catch {
      setSuggestions([]);
    }
  }

  // Town-wide event lookup, once schedule + address are known and step 3 is reached.
  useEffect(() => {
    if (step !== 3) return;
    if (!selectedCoords || !startDate || !endDate) {
      setMatchedEvent(null);
      return;
    }
    setMatchedEvent(undefined);
    findNearbyEvent({ latitude: selectedCoords.latitude, longitude: selectedCoords.longitude, startDate, endDate })
      .then(async (event) => {
        setMatchedEvent(event);
        if (event) setEventParticipantCount(await fetchEventParticipantCount(event.id));
      })
      .catch(() => setMatchedEvent(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function toggleCategory(name: string) {
    setCategories((prev) => {
      const next = prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name];
      if (name === 'Other' && prev.includes('Other')) setOtherItems([]);
      return next;
    });
  }

  function handleAddOtherItem(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const trimmed = otherDraft.trim();
    if (trimmed) setOtherItems((prev) => [...prev, trimmed]);
    setOtherDraft('');
  }

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;

    const remaining = MAX_LISTING_PHOTOS - photos.length;
    if (remaining <= 0) {
      setPhotoError(`You can add up to ${MAX_LISTING_PHOTOS} photos.`);
      return;
    }

    setPickingPhoto(true);
    setPhotoError(null);
    try {
      for (const file of files.slice(0, remaining)) {
        const prepared = await preparePickedPhoto(file);
        setPhotos((prev) => [...prev, prepared]);
      }
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'That photo could not be read. Please try again.');
    } finally {
      setPickingPhoto(false);
    }
  }

  function removePhoto(index: number) {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function handlePublish() {
    setPublishing(true);
    setPublishError(null);
    try {
      const coords = selectedCoords ?? (await geocodeAddress(address));

      const { id, categoryIds: _categoryIds } = await createSaleListing({
        sellerId: userId,
        latitude: coords.latitude,
        longitude: coords.longitude,
        addressText: address,
        immediateRevealOptIn: showExactAddress,
        startDate,
        endDate,
        dailyStartTime: startTime,
        dailyEndTime: endTime,
        title: title || undefined,
        paymentMethod,
        description,
        otherItems,
        categoryNames: categories,
      });
      void _categoryIds;

      await uploadPendingPhotos(id, photos);
      await publishSaleListing({ id, description });

      if (joinEventStatus === 'requested' && matchedEvent) {
        try {
          await submitEventJoinRequest({ eventId: matchedEvent.id, listingId: id, sellerId: userId });
        } catch (err) {
          console.error('Failed to submit event join request', err);
        }
      }

      setPublishedListingId(id);
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Something went wrong publishing your sale.');
    } finally {
      setPublishing(false);
    }
  }

  if (publishedListingId) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-20 text-center sm:px-6">
        <h1 className="font-display text-2xl font-semibold text-ink">Your sale is live! 🎉</h1>
        <p className="text-sm text-muted">Buyers can find it on Discover now.</p>
        <div className="flex gap-3">
          <Link href={`/sale/${publishedListingId}`} className="rounded-full bg-coral px-4 py-2.5 font-display text-sm font-semibold text-paper hover:bg-[#e55a3c]">
            View my listing
          </Link>
          <Link href="/" className="rounded-full border-2 border-tan-border bg-paper px-4 py-2.5 font-display text-sm font-semibold text-ink hover:border-ink">
            Back to Discover
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-2xl font-semibold text-ink">List a sale</h1>
      <div className="mt-3 flex gap-1.5">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i + 1 <= step ? 'bg-coral' : 'bg-tan-border'}`} />
        ))}
      </div>

      {publishError && <p className="mt-4 rounded-lg bg-error-bg px-3 py-2 text-sm text-error-text">{publishError}</p>}

      {step === 1 && (
        <div className="mt-6 flex flex-col gap-4">
          <div className="relative">
            <label className="flex flex-col gap-1 text-sm font-medium text-ink">
              Address
              <input
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  setSelectedCoords(null);
                }}
                onFocus={() => setIsAddressFocused(true)}
                onBlur={() => setTimeout(() => setIsAddressFocused(false), 150)}
                placeholder="Start typing your address…"
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

          <div className="h-48 overflow-hidden rounded-2xl border-2 border-tan-border">
            <ListingsMap
              listings={selectedCoords ? [{ id: 'preview', title: address || 'Sale location', ...selectedCoords }] : []}
              center={selectedCoords ?? undefined}
              zoom={14}
            />
          </div>

          <label className="flex items-start gap-2 text-sm text-ink">
            <input type="checkbox" checked={showExactAddress} onChange={(e) => setShowExactAddress(e.target.checked)} className="mt-0.5 h-4 w-4" />
            <span>
              Show my exact address right away (otherwise it stays approximate until the morning of your sale)
            </span>
          </label>

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

          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-ink">
              Daily start time
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="rounded-xl border-2 border-tan-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-coral"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-ink">
              Daily end time
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="rounded-xl border-2 border-tan-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-coral"
              />
            </label>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="mt-6 flex flex-col gap-5">
          <div>
            <p className="text-sm font-medium text-ink">Photos ({photos.length}/{MAX_LISTING_PHOTOS})</p>
            {photoError && <p className="mt-1 rounded-lg bg-error-bg px-3 py-2 text-sm text-error-text">{photoError}</p>}
            <div className="mt-2 grid grid-cols-4 gap-2">
              {photos.map((photo, i) => (
                <div key={photo.previewUrl} className="relative aspect-square overflow-hidden rounded-xl border-2 border-tan-border bg-amber-bg">
                  <Image src={photo.previewUrl} alt="" fill sizes="100px" className="object-cover" unoptimized />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white"
                    aria-label="Remove photo"
                  >
                    ×
                  </button>
                </div>
              ))}
              {photos.length < MAX_LISTING_PHOTOS && (
                <label className="flex aspect-square cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-tan-border text-2xl text-muted hover:border-coral">
                  {pickingPhoto ? '…' : '+'}
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleFilesSelected} disabled={pickingPhoto} />
                </label>
              )}
            </div>
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
                    categories.includes(c) ? 'border-coral bg-coral text-paper' : 'border-tan-border bg-white text-ink hover:border-ink'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {categories.includes('Other') && (
            <div>
              <label className="flex flex-col gap-1 text-sm font-medium text-ink">
                What else are you bringing?
                <input
                  value={otherDraft}
                  onChange={(e) => setOtherDraft(e.target.value)}
                  onKeyDown={handleAddOtherItem}
                  placeholder="Type an item and press Enter"
                  className="rounded-xl border-2 border-tan-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-coral"
                />
              </label>
              {otherItems.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {otherItems.map((item, i) => (
                    <span key={`${item}-${i}`} className="flex items-center gap-1 rounded-full bg-amber-bg px-3 py-1 text-sm text-amber-text">
                      {item}
                      <button type="button" onClick={() => setOtherItems((prev) => prev.filter((_, idx) => idx !== i))} aria-label={`Remove ${item}`}>
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setAiModalOpen(true)}
            className="self-start rounded-full border-2 border-tan-border bg-white px-4 py-2 text-sm font-medium text-ink transition hover:border-coral"
          >
            ✨ Get AI suggestions
          </button>

          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Title (optional)
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-xl border-2 border-tan-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-coral"
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
              className="rounded-xl border-2 border-tan-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-coral"
            />
          </label>
        </div>
      )}

      {step === 3 && (
        <div className="mt-6">
          {matchedEvent === undefined && <p className="text-sm text-muted">Checking for nearby town-wide events…</p>}
          {matchedEvent === null && (
            <p className="rounded-2xl border-2 border-dashed border-tan-border bg-paper p-4 text-sm text-muted">
              No town-wide event matches your dates and area — you&apos;re listing independently.
            </p>
          )}
          {matchedEvent && (
            <div className="rounded-2xl border-2 border-tan-border bg-paper p-4">
              <p className="font-tag text-sm font-bold text-violet">Town-wide event nearby</p>
              <p className="mt-1 font-display text-lg font-semibold text-ink">{matchedEvent.name}</p>
              <p className="mt-1 text-sm text-muted">{eventParticipantCount} sales already joined</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setJoinEventStatus('requested')}
                  className={`flex-1 rounded-full border-2 px-3 py-2 text-sm font-medium ${
                    joinEventStatus === 'requested' ? 'border-coral bg-coral text-paper' : 'border-tan-border bg-white text-ink'
                  }`}
                >
                  Request to join
                </button>
                <button
                  type="button"
                  onClick={() => setJoinEventStatus('declined')}
                  className={`flex-1 rounded-full border-2 px-3 py-2 text-sm font-medium ${
                    joinEventStatus === 'declined' ? 'border-ink bg-tan text-ink' : 'border-tan-border bg-white text-ink'
                  }`}
                >
                  Not this time
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 4 && (
        <div className="mt-6 flex flex-col gap-3 rounded-2xl border-2 border-tan-border bg-paper p-4 text-sm text-ink">
          <p className="font-display text-lg font-semibold">Review your listing</p>
          <p>{photos.length} photo{photos.length === 1 ? '' : 's'}</p>
          <p>{address || 'No address entered'}</p>
          <p>
            {startDate || '?'} – {endDate || '?'} · {startTime}–{endTime}
          </p>
          <p>{categories.length > 0 ? categories.join(', ') : 'No categories selected'}</p>
          {otherItems.length > 0 && <p>Other items: {otherItems.join(', ')}</p>}
          {description && <p>{description}</p>}
          <p className="text-muted">
            {matchedEvent && joinEventStatus === 'requested' ? `Joining ${matchedEvent.name}` : 'Independent listing'}
          </p>
        </div>
      )}

      <div className="mt-6 flex justify-between">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1}
          className="rounded-full border-2 border-tan-border bg-white px-4 py-2.5 font-display text-sm font-semibold text-ink disabled:opacity-40"
        >
          Back
        </button>
        {step < TOTAL_STEPS ? (
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(TOTAL_STEPS, s + 1))}
            className="rounded-full bg-coral px-4 py-2.5 font-display text-sm font-semibold text-paper hover:bg-[#e55a3c]"
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            onClick={handlePublish}
            disabled={publishing}
            className="rounded-full bg-coral px-4 py-2.5 font-display text-sm font-semibold text-paper hover:bg-[#e55a3c] disabled:opacity-60"
          >
            {publishing ? 'Publishing…' : 'Publish'}
          </button>
        )}
      </div>

      <AiSuggestionModal
        open={aiModalOpen}
        categories={categories}
        otherItems={otherItems}
        onClose={() => setAiModalOpen(false)}
        onAccept={(newTitle, newDescription) => {
          setTitle(newTitle);
          setDescription(newDescription);
        }}
      />
    </div>
  );
}
