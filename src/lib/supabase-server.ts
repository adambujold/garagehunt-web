import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Server Component / Server Action Supabase client — reads the incoming
// request's cookies for the current session. Writes (setAll) are wrapped in
// try/catch because Server Components can't set cookies; when this is
// called from one, middleware.ts is what actually refreshes the session
// cookie, so a swallowed write here is expected, not a bug.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component — safe to ignore since
            // middleware.ts refreshes the session cookie on every request.
          }
        },
      },
    }
  );
}
