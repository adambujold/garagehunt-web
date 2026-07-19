'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { addFavorite, removeFavorite } from '@/lib/favorites';

// Optimistic toggle + rollback-on-error, same pattern as the mobile app's
// Sale Detail screen (app/sale/[id].tsx's handleToggleFavorite) — bump the
// heart and the displayed count immediately, undo both if the write fails.
export function FavoriteHeart({
  listingId,
  userId,
  initialFavorited,
  initialCount,
  redirectPath,
  size = 'sm',
}: {
  listingId: string;
  userId: string | null;
  initialFavorited: boolean;
  initialCount: number;
  redirectPath: string;
  size?: 'sm' | 'lg';
}) {
  const router = useRouter();
  const [isFavorited, setIsFavorited] = useState(initialFavorited);
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (!userId) {
      router.push(`/login?redirectTo=${encodeURIComponent(redirectPath)}`);
      return;
    }
    if (pending) return;

    const nextFavorited = !isFavorited;
    const delta = nextFavorited ? 1 : -1;
    setPending(true);
    setIsFavorited(nextFavorited);
    setCount((c) => Math.max(0, c + delta));

    try {
      if (nextFavorited) {
        await addFavorite(userId, listingId);
      } else {
        await removeFavorite(userId, listingId);
      }
    } catch (err) {
      console.error('Failed to toggle favorite', err);
      setIsFavorited(!nextFavorited);
      setCount((c) => Math.max(0, c - delta));
    } finally {
      setPending(false);
    }
  }

  const iconSize = size === 'lg' ? 'text-xl' : 'text-base';
  const textSize = size === 'lg' ? 'text-sm' : 'text-xs';

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        handleClick();
      }}
      disabled={pending}
      className="inline-flex items-center gap-1.5 disabled:opacity-60"
      aria-pressed={isFavorited}
      aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
    >
      <span className={iconSize} style={{ color: isFavorited ? 'var(--color-interest-pink)' : 'var(--color-muted)' }}>
        {isFavorited ? '♥' : '♡'}
      </span>
      {count > 0 && (
        <span className={`${textSize} font-medium text-interest-pink`}>
          {count} {count === 1 ? 'person' : 'people'} interested
        </span>
      )}
    </button>
  );
}
