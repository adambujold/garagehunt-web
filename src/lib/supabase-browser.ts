import { createBrowserClient } from '@supabase/ssr';

// Client-component Supabase client — reads/writes the session via
// document.cookie so the same session is visible to Server Components and
// middleware on the next request. This is a separate module from
// src/lib/supabase.ts (Phase 1's plain anon client for public server-side
// reads) since that one never needs cookies.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
