import { createClient } from '@/lib/supabase-browser';

// Ported from the mobile app's utils/moderation.ts — same two Edge
// Functions, same fail-safe-to-'flag' behavior on any invoke/timeout error
// so a seller's upload/publish is never blocked by our own infrastructure
// being down, without silently skipping review either.

const MODERATION_TIMEOUT_MS = 25000;

function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), MODERATION_TIMEOUT_MS);
    promise.then(
      (result) => {
        clearTimeout(timer);
        resolve(result);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      }
    );
  });
}

export type ModerationDecision = 'approve' | 'flag' | 'reject';

export async function moderateListingPhoto(imageBase64: string, mediaType: string): Promise<ModerationDecision> {
  const supabase = createClient();
  return withTimeout(
    (async () => {
      const { data, error } = await supabase.functions.invoke('moderate-listing-photo', {
        body: { image_base64: imageBase64, media_type: mediaType },
      });
      if (error || !data?.decision) return 'flag';
      return data.decision as ModerationDecision;
    })(),
    'flag'
  );
}

export type TextModerationResult = { decision: ModerationDecision; reason: string };

export async function moderateListingText(description: string): Promise<TextModerationResult> {
  const supabase = createClient();
  return withTimeout(
    (async () => {
      const { data, error } = await supabase.functions.invoke('moderate-listing-text', {
        body: { description },
      });
      if (error || !data?.decision) return { decision: 'flag' as const, reason: '' };
      return {
        decision: data.decision as ModerationDecision,
        reason: typeof data.reason === 'string' ? data.reason : '',
      };
    })(),
    { decision: 'flag', reason: '' }
  );
}
