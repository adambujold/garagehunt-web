import { createClient } from '@/lib/supabase-browser';
// moderateListingText is no longer called here — text screening moved inside
// the publish-listing Edge Function (0041), where a client can't skip it.
// lib/moderation.ts keeps the wrapper for moderateListingPhoto, still used at
// upload time.

// Web port of the mobile app's utils/sale-listings.ts write path — create,
// publish, update, and cancel. Deliberately skips the
// computeAndInsertMatches/detectClusterForListing side effects publishing
// triggers on mobile, since "I'm Looking For" saved searches and cluster
// suggestions aren't built on the website yet — nothing would consume them.
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

export type PublishSaleListingInput = {
  id: string;
  /**
   * Retained so callers don't all need changing, but no longer sent: the
   * publish-listing Edge Function reads the description from the database
   * itself, so a caller can't submit different text for screening than the
   * row actually holds.
   */
  description?: string;
};

// The photo gate, text moderation, first-listing trust signal, and the
// status/moderation_status write all moved into the publish-listing Edge
// Function. On the client they were advisory — nothing stopped a seller
// writing status='published', moderation_status='clean' directly and skipping
// review. 0041_server_side_publish_gate.sql now rejects that transition at the
// database, making this the only route through.
export async function publishSaleListing(input: PublishSaleListingInput): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke('publish-listing', {
    body: { listing_id: input.id },
  });

  if (error) {
    // A non-2xx arrives as FunctionsHttpError with our own JSON body attached;
    // that message is written for the seller (a rejected description's reason,
    // or the flagged-photo explanation), so surface it rather than a generic.
    const response = (error as { context?: Response }).context;
    let message: string | null = null;
    try {
      const body = await response?.json();
      if (body?.error) message = body.error as string;
    } catch {
      // No JSON body — failed below our function (gateway/network).
    }
    if (!message) {
      // A 404 means the Edge Function isn't deployed. Previously this showed a
      // generic "something went wrong", which cost a real debugging session —
      // name the actual cause.
      message =
        response?.status === 404
          ? "Publishing isn't available right now — the publish-listing function isn't deployed. (If you're the developer: deploy supabase/functions/publish-listing.)"
          : `Something went wrong publishing your listing${response?.status ? ` (error ${response.status})` : ''}.`;
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error as string);
}

export type UpdateSaleListingInput = {
  id: string;
  startDate: string;
  endDate: string;
  title?: string;
  paymentMethod: PaymentMethod;
  description: string;
  otherItems: string[];
  categoryNames: string[];
  /** true when this save should also take a draft live ("Publish sale"). */
  publish?: boolean;
};

// Mirrors the app's updateSaleListing. status is never set here even when
// publish is true — publishSaleListing above is the only path allowed to flip
// a listing to 'published', because it's also the moderation gate (feature
// spec Section 9). Field edits still save even if that gate then blocks the
// publish.
//
// Address and coordinates are deliberately absent: locked after publish per
// the architecture doc, since silently moving a live listing is a trust risk.
export async function updateSaleListing(input: UpdateSaleListingInput): Promise<void> {
  const supabase = createClient();

  const { error: updateError } = await supabase
    .from('sale_listings')
    .update({
      start_date: input.startDate,
      end_date: input.endDate,
      title: input.title?.trim() ? input.title.trim() : null,
      payment_method: input.paymentMethod,
      description: input.description || null,
      other_items: input.otherItems,
    })
    .eq('id', input.id);
  if (updateError) throw updateError;

  // Replace the category set wholesale — simpler and just as correct as
  // diffing, given there are only 11 possible categories.
  const { error: deleteError } = await supabase
    .from('listing_categories')
    .delete()
    .eq('listing_id', input.id);
  if (deleteError) throw deleteError;

  if (input.categoryNames.length > 0) {
    const { data: categoryRows, error: categoryError } = await supabase
      .from('categories')
      .select('id, name')
      .in('name', input.categoryNames);
    if (categoryError) throw categoryError;

    if (categoryRows && categoryRows.length > 0) {
      const { error: linkError } = await supabase
        .from('listing_categories')
        .insert(categoryRows.map((c) => ({ listing_id: input.id, category_id: c.id })));
      if (linkError) throw linkError;
    }
  }

  if (input.publish) {
    await publishSaleListing({ id: input.id, description: input.description });
  }
}

export async function cancelSaleListing(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('sale_listings').update({ status: 'cancelled' }).eq('id', id);
  if (error) throw error;
}
