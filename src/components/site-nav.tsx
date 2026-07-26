"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

// The website's equivalent of the mobile app's tab bar. Every one of these
// routes was already built and deployed but had no link anywhere in the
// header, so the whole site read as "just a listings page" — this is what
// makes the rest of it reachable.
//
// A Client Component only because it needs usePathname (active route) and
// open/close state for the small-screen menu. The signed-in email + Log out
// form stay server-rendered in layout.tsx and come in through `authArea`, so
// the sign-out Server Action never has to cross the client boundary.

export type NavLink = { href: string; label: string };

export function SiteNav({ links, authArea }: { links: NavLink[]; authArea: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // "/" would otherwise match every route as a prefix.
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      {/* Desktop / tablet */}
      <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive(link.href) ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              isActive(link.href)
                ? "bg-lavender text-ink"
                : "text-muted-dark hover:bg-lavender/60 hover:text-ink"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      {/* Small screens: hamburger toggle. The panel itself is rendered below. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="site-mobile-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-tan-border bg-white text-ink md:hidden"
      >
        <span aria-hidden className="text-base leading-none">
          {open ? "×" : "☰"}
        </span>
      </button>

      {open && (
        <div
          id="site-mobile-menu"
          className="absolute inset-x-0 top-full z-50 border-b-2 border-tan-border bg-paper shadow-lg md:hidden"
        >
          <nav aria-label="Main" className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3 sm:px-6">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                // Close on tap — the header never unmounts between route
                // changes, so the panel would otherwise stay open over the
                // new page. Done here rather than in an effect on pathname,
                // which triggers a cascading re-render (and the lint rule
                // react-hooks/set-state-in-effect).
                onClick={() => setOpen(false)}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={`rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive(link.href) ? "bg-lavender text-ink" : "text-ink hover:bg-lavender/60"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 border-t-2 border-tan-border pt-3">{authArea}</div>
          </nav>
        </div>
      )}
    </>
  );
}
