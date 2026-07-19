import type { MetadataRoute } from "next";

import { getAllEventIds, getAllPublishedListingIds } from "@/lib/listings";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [listings, eventIds] = await Promise.all([getAllPublishedListingIds(), getAllEventIds()]);

  return [
    { url: siteUrl, changeFrequency: "hourly", priority: 1 },
    ...listings.map((listing) => ({
      url: `${siteUrl}/sale/${listing.id}`,
      lastModified: listing.updatedAt,
      changeFrequency: "hourly" as const,
      priority: 0.8,
    })),
    ...eventIds.map((id) => ({
      url: `${siteUrl}/event/${id}`,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  ];
}
