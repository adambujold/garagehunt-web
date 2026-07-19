import type { Metadata } from "next";
import { Fredoka, Kalam, Work_Sans } from "next/font/google";
import Link from "next/link";
import "./globals.css";

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

function SiteHeader() {
  return (
    <header className="border-b-2 border-tan-border bg-paper">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
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
