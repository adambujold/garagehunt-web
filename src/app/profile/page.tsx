import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { signOut } from "@/app/auth/actions";
import { PriceTag } from "@/components/price-tag";
import {
  deriveShopperTier,
  nextShopperTierProgress,
  SHOPPER_TIER_LABELS,
  SHOPPER_TIER_THRESHOLDS,
} from "@/lib/brand";
import { createClient } from "@/lib/supabase-server";

// The website's equivalent of the app's Profile tab — account info, seller
// reputation, buyer tier, and the shortcuts into everything else. Last piece
// of the seller dashboard the website never had.
export const metadata: Metadata = {
  title: "Profile",
  robots: { index: false, follow: false },
};

type ProfileRow = {
  created_at: string;
  seller_avg_rating: number | null;
  seller_review_count: number;
  buyer_checkin_count: number;
  is_verified_organizer: boolean;
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/profile");

  // maybeSingle, not single: an account whose public.users row hasn't been
  // backfilled yet should still get a usable page rather than a crash.
  const { data, error } = await supabase
    .from("users")
    .select("created_at, seller_avg_rating, seller_review_count, buyer_checkin_count, is_verified_organizer")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;

  const profile = (data ?? null) as ProfileRow | null;
  const checkinCount = profile?.buyer_checkin_count ?? 0;
  const tier = deriveShopperTier(checkinCount);
  const tierProgress = nextShopperTierProgress(checkinCount);
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-CA", { month: "long", year: "numeric" })
    : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-semibold text-ink">Profile</h1>

      <section className="mt-6 rounded-2xl border-2 border-tan-border bg-paper p-5">
        <p className="font-display text-lg font-semibold text-ink">{user.email}</p>
        {memberSince && <p className="mt-1 text-sm text-muted">Member since {memberSince}</p>}

        <div className="mt-3 flex flex-wrap gap-1.5">
          {profile?.is_verified_organizer && (
            <PriceTag label="Verified organizer" variant="organizer" rotate={-2} />
          )}
          {tier && <PriceTag label={SHOPPER_TIER_LABELS[tier]} variant="live" rotate={-2} />}
        </div>

        {/* Seller reputation aggregates across all of a seller's sales, not
            per-listing (feature spec 4d). Nothing renders at zero reviews
            rather than a misleading "0★". */}
        {profile && profile.seller_review_count > 0 && profile.seller_avg_rating !== null && (
          <p className="mt-3 text-sm text-ink">
            <span className="font-medium">{profile.seller_avg_rating.toFixed(1)}★</span>{" "}
            <span className="text-muted">
              · {profile.seller_review_count} {profile.seller_review_count === 1 ? "review" : "reviews"} as a
              seller
            </span>
          </p>
        )}
      </section>

      <section className="mt-4 rounded-2xl border-2 border-tan-border bg-paper p-5">
        <h2 className="font-display text-lg font-semibold text-ink">Shopper status</h2>
        <p className="mt-1 text-sm text-muted">
          {checkinCount} {checkinCount === 1 ? "check-in" : "check-ins"}
          {tierProgress && ` · ${tierProgress.remaining} more for ${tierProgress.nextLabel}`}
        </p>
        {/* A badge system with no visible explanation just feels arbitrary —
            feature spec 4e asks for this explainer explicitly. */}
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-medium text-ink underline underline-offset-2">
            How to earn badges
          </summary>
          <p className="mt-2 text-sm text-muted">
            Check in at a sale while you&apos;re there to prove you visited. Check-ins unlock{" "}
            <strong className="text-ink">Regular</strong> at {SHOPPER_TIER_THRESHOLDS.regular},{" "}
            <strong className="text-ink">Trusted Shopper</strong> at {SHOPPER_TIER_THRESHOLDS.trustedShopper}, and{" "}
            <strong className="text-ink">Super Shopper</strong> at {SHOPPER_TIER_THRESHOLDS.superShopper}. Checking
            in also marks your reviews as a verified visit.
          </p>
        </details>
      </section>

      <section className="mt-4 rounded-2xl border-2 border-tan-border bg-paper p-5">
        <h2 className="font-display text-lg font-semibold text-ink">Shortcuts</h2>
        <ul className="mt-3 flex flex-col divide-y-2 divide-tan-border">
          <ShortcutLink href="/my-listings" label="My Listings" hint="Your sales, stats, and edits" />
          <ShortcutLink href="/favorites" label="Favorites" hint="Sales you've hearted" />
          <ShortcutLink href="/saved-searches" label="Looking For" hint="Alerts for items you want" />
          <ShortcutLink href="/route-planner" label="Route Planner" hint="Plan a day of sales" />
          <ShortcutLink
            href={profile?.is_verified_organizer ? "/organizer-dashboard" : "/organizer-application"}
            label={profile?.is_verified_organizer ? "Organizer dashboard" : "Become an organizer"}
            hint={
              profile?.is_verified_organizer
                ? "Manage your town-wide events"
                : "Run a town-wide sale for your area"
            }
          />
        </ul>
      </section>

      <form action={signOut} className="mt-6">
        <button
          type="submit"
          className="text-sm font-medium text-error-text underline underline-offset-2"
        >
          Log out
        </button>
      </form>
    </div>
  );
}

function ShortcutLink({ href, label, hint }: { href: string; label: string; hint: string }) {
  return (
    <li>
      <Link href={href} className="flex items-center justify-between gap-3 py-3 transition hover:text-coral">
        <span>
          <span className="block text-sm font-medium text-ink">{label}</span>
          <span className="block text-xs text-muted">{hint}</span>
        </span>
        <span aria-hidden className="text-muted">
          →
        </span>
      </Link>
    </li>
  );
}
