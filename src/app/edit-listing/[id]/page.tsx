import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { EditListingForm } from "@/components/edit-listing-form";
import { getEditableListing } from "@/lib/my-listings";
import { createClient } from "@/lib/supabase-server";

export const metadata: Metadata = {
  title: "Edit listing",
  robots: { index: false, follow: false },
};

type PageProps = { params: Promise<{ id: string }> };

export default async function EditListingPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirectTo=/edit-listing/${id}`);

  // getEditableListing is scoped to seller_id, so this is null both for a
  // listing that doesn't exist and for someone else's — notFound() either
  // way, so listing ids can't be probed for existence. The database enforces
  // this independently (0038_sale_listings_view_write_authorization.sql).
  const listing = await getEditableListing(id, user.id);
  if (!listing) notFound();

  return <EditListingForm listing={listing} />;
}
