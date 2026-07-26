import type { Metadata } from "next";
import { Fredoka, Kalam, Work_Sans } from "next/font/google";
import Link from "next/link";
import "./globals.css";

import { SiteNav, type NavLink } from "@/components/site-nav";
import { createClient } from "@/lib/supabase-server";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["500", "600"],
});

const kalam = Kalam({
  variable: "--font-kalam",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const workSans = Work_Sans({
  variable: "--font-work-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "GarageHunt — Find garage sales near you",
    template: "%s · GarageHunt",
  },
  description:
    "Discover garage sales, yard sales, and town-wide sale events near you. Browse what's for sale, plan your route, and find your next great deal.",
  openGraph: {
    siteName: "GarageHunt",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fredoka.variable} ${kalam.variable} ${workSans.variable} h-full`}
    >
      <body className="min-h-full flex flex-col font-body text-ink bg-lavender antialiased">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}

// Mirrors the mobile app's tab bar. Everything below already existed as a
// working route; none of it was linked from anywhere, which is why the site
// looked far more basic than it is.
function buildNavLinks(userId: string | null): NavLink[] {
  // Signed out: only the two routes that make sense as an entry point. The
  // rest are auth-gated by proxy.ts and would just bounce to /login.
  if (!userId) {
    return [
      { href: "/", label: "Discover" },
      { href: "/list-a-sale", label: "List a Sale" },
    ];
  }

  // Kept deliberately short. An earlier version listed every route plus the
  // signed-in email and Log out, which wrapped onto two lines and read as
  // cluttered. This mirrors the app instead: a handful of primary
  // destinations, with everything secondary (My Listings, Organizer, Log out)
  // living under Profile — which is exactly what the app's Profile tab does.
  return [
    { href: "/", label: "Discover" },
    { href: "/list-a-sale", label: "List a Sale" },
    { href: "/favorites", label: "Favorites" },
    // The app calls this "Looking for"; same feature, saved_searches.
    { href: "/saved-searches", label: "Looking For" },
    { href: "/route-planner", label: "Route Planner" },
    { href: "/profile", label: "Profile" },
  ];
}

async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const links = buildNavLinks(user?.id ?? null);

  // Signed in, the header carries no account chrome at all — the email and
  // Log out both used to sit here and were the widest things in the bar. They
  // live on /profile now, which the nav links to. Only the signed-out
  // Log in / Sign up pair still renders here, where space isn't a problem.
  const authArea = user ? null : (
    <div className="flex items-center gap-4 text-sm font-medium">
      <Link href="/login" className="text-ink underline underline-offset-2 hover:text-coral">
        Log in
      </Link>
      <Link href="/register" className="rounded-full bg-coral px-3.5 py-1.5 text-paper hover:bg-[#e55a3c]">
        Sign up
      </Link>
    </div>
  );

  return (
    // relative: the small-screen menu panel positions itself against this.
    <header className="relative border-b-2 border-tan-border bg-paper">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex h-9 w-9 items-center justify-center bg-marigold text-ink"
            style={{
              borderTopLeftRadius: 10,
              borderTopRightRadius: 10,
              borderBottomRightRadius: 10,
              borderBottomLeftRadius: 3,
              transform: "rotate(-10deg)",
            }}
          >
            <PinIcon className="h-4 w-4" />
          </span>
          <span className="font-display text-xl font-semibold tracking-tight">GarageHunt</span>
        </Link>

        <div className="flex items-center gap-2">
          <SiteNav links={links} authArea={authArea} />
          {/* Duplicated rather than moved into SiteNav so it stays server-
              rendered; hidden on small screens, where it appears inside the
              menu panel instead. Null when signed in — see authArea above. */}
          {authArea && <div className="hidden lg:block">{authArea}</div>}
        </div>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t-2 border-tan-border bg-paper">
      <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-muted sm:px-6">
        <p>
          GarageHunt is a Canada-wide directory of garage sales, yard sales, and town-wide sale
          events.{" "}
          <a href="https://adambujold.github.io/garagehunt-legal/" className="underline underline-offset-2 hover:text-ink">
            Privacy Policy
          </a>{" "}
          ·{" "}
          <a href="https://adambujold.github.io/garagehunt-legal/terms.html" className="underline underline-offset-2 hover:text-ink">
            Terms of Service
          </a>
        </p>
      </div>
    </footer>
  );
}

export function PinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2c-4.4 0-8 3.6-8 8 0 5.4 7 11.5 7.3 11.8.2.1.4.2.7.2s.5-.1.7-.2C12.9 21.5 20 15.4 20 10c0-4.4-3.6-8-8-8Zm0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z" />
    </svg>
  );
}
