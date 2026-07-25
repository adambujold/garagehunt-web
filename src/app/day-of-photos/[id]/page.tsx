import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { DayOfPhotosForm } from "@/components/day-of-photos-form";
import { deriveTitle } from "@/lib/format";
import { createClient } from "@/lib/supabase-server";

// The lightweight "snap fresh photos" flow the day-of reminder email links to
// (feature spec 4f / tech arch Section 10). The reminder's button points at
// https://garagehunt.ca/day-of-photos/<id>; middleware already gates this
// prefix on auth, and the ownership check below makes it seller-only.
//
// noindex — a private seller action page, never something to surface in
// search (unlike the public, crawlable sale detail pages).
export const metadata: Metadata = {
  title: "Add today's photos",
  robots: { index: false, follow: false },
};

type PageProps = { params: Promise<{ id: string }> };

export default async function DayOfPhotosPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Belt-and-suspenders with the middleware gate (same pattern as
  // /list-a-sale) — the redirectTo brings the seller straight back here after
  // logging in, so an email link tapped while logged out still works.
  if (!user) redirect(`/login?redirectTo=/day-of-photos/${id}`);

  const { data: listing, error } = await supabase
    .from("sale_listings")
    .select("seller_id, title, address_text, status")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;

  // notFound (not a detailed error) when the listing is missing OR isn't the
  // caller's own — a seller must never be able to probe another seller's
  // listings by guessing ids at this route.
  if (!listing || listing.seller_id !== user.id) notFound();

  const listingTitle = listing.title?.trim() ? listing.title : deriveTitle(listing.address_text);

  return <DayOfPhotosForm listingId={id} listingTitle={listingTitle} />;
}
