import { createClient } from '@/lib/supabase-browser';

// Ported from the mobile app's utils/ai-suggestions.ts — same Edge
// Function, same input/output shape.
export type SuggestListingCopyInput = {
  categories: string[];
  otherItems: string[];
  prompt?: string;
};

export type SuggestListingCopyResult = { title: string; description: string };

export async function suggestListingCopy(input: SuggestListingCopyInput): Promise<SuggestListingCopyResult> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke('suggest-listing-copy', { body: input });

  if (error) {
    const context = (error as { context?: { error?: string } }).context;
    throw new Error(context?.error || 'Could not generate a suggestion right now.');
  }
  if (!data?.title || !data?.description) {
    throw new Error('Could not generate a suggestion right now.');
  }
  return { title: data.title, description: data.description };
}
