import { createClient } from '@/lib/supabase-browser';
import { moderateListingText } from '@/lib/moderation';

// Web port of the mobile app's utils/sale-listings.ts createSaleListing +
// publishSaleListing — scoped to just what List a Sale needs (this phase
// doesn't include Edit/Cancel/Boost, and deliberately skips the
// computeAndInsertMatches/detectClusterForListing side effects publishing
// triggers on mobile, since "I'm Looking For" saved searches and cluster
// suggestions aren't built on the website yet — nothing would consume them).
//
// Inserts/updates go through the public.sale_listings view (never
// sale_listings_raw directly) — see the mobile repo's
// 0034_address_privacy_enforcement.sql for the INSTEAD OF triggers that
// make this view insertable/updatable in the first place.

export type PaymentMethod = 'cash_only' | 'cash_and_etransfer';

export type CreateSaleListingInput = {
  sellerId: string;
  latitude: number;
  longitude: number;
  addressText: string;
  immediateRevealOptIn: boolean;
  startDate: string;
  endDate: string;
  dailyStartTime: string;
  dailyEndTime: string;
  title?: string;
  paymentMethod: PaymentMethod;
  description: string;
  otherItems: string[];
  categoryNames: string[];
};

export type CreateSaleListingResult = { id: string; categoryIds: string[] };

export async function createSaleListing(input: CreateSaleListingInput): Promise<CreateSaleListingResult> {
  const supabase = createClient();
  const revealAt = input.immediateRevealOptIn
    ? new Date().toISOString()
    : new Date(`${input.startDate}T00:00:00`).toISOString();

  const { data: listing, error: insertError } = await supabase
    .from('sale_listings')
    .insert({
      seller_id: input.sellerId,
      latitude: input.latitude,
      longitude: input.longitude,
      address_text: input.addressText,
      reveal_at: revealAt,
      immediate_reveal_opt_in: input.immediateRevealOptIn,
      start_date: input.startDate,
      end_date: input.endDate,
      daily_start_time: input.dailyStartTime,
      daily_end_time: input.dailyEndTime,
      status: 'draft',
      title: input.title?.trim() ? input.title.trim() : null,
      payment_method: input.paymentMethod,
      description: input.description || null,
      other_items: input.otherItems,
    })
    .select('id')
    .single();

  if (insertError) throw insertError;

  let categoryIds: string[] = [];
  if (input.categoryNames.length > 0) {
    const { data: categoryRows, error: categoryError } = await supabase
      .from('categories')
      .select('id, name')
      .in('name', input.categoryNames);
    if (categoryError) throw categoryError;

    if (categoryRows && categoryRows.length > 0) {
      categoryIds = categoryRows.map((c) => c.id);
      const { error: linkError } = await supabase
        .from('listing_categories')
        .insert(categoryRows.map((c) => ({ listing_id: listing.id, category_id: c.id })));
      if (linkError) throw linkError;
    }
  }

  return { id: listing.id, categoryIds };
}

export type PublishSaleListingInput = { id: string; description: string };

export async function publishSaleListing(input: PublishSaleListingInput): Promise<void> {
  const supabase = createClient();
  const { data: listingRow, error: fetchError } = await supabase
    .from('sale_listings')
    .select('seller_id')
    .eq('id', input.id)
    .single();
  if (fetchError) throw fetchError;

  const { data: photos, error: photosError } = await supabase
    .from('listing_photos')
    .select('moderation_status')
    .eq('listing_id', input.id);
  if (photosError) throw photosError;
  if ((photos ?? []).some((p) => p.moderation_status !== 'approved')) {
    throw new Error(
      "One or more of your photos was flagged for manual review and can't be auto-approved — publishing again won't change that. Your listing has been saved as a draft; remove/replace the flagged photo, or wait for it to be manually approved."
    );
  }

  const textResult = await moderateListingText(input.description);
  if (textResult.decision === 'reject') {
    throw new Error(textResult.reason || 'Your listing description needs to be revised before publishing.');
  }

  const { count: publishedCount, error: countError } = await supabase
    .from('sale_listings')
    .select('id', { count: 'exact', head: true })
    .eq('seller_id', listingRow.seller_id)
    .eq('status', 'published');
  if (countError) throw countError;
  const isFirstListing = (publishedCount ?? 0) === 0;

  const moderationStatus: 'clean' | 'pending_review' =
    isFirstListing || textResult.decision === 'flag' ? 'pending_review' : 'clean';

  const { error: publishError } = await supabase
    .from('sale_listings')
    .update({ status: 'published', moderation_status: moderationStatus })
    .eq('id', input.id);
  if (publishError) throw publishError;
}
