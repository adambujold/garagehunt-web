import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Routes that require a signed-in session. Organizer-specific routes are
// also gated on is_verified_organizer, but that check happens in each
// page itself (a Server Component DB read) — middleware only checks auth,
// same as every other protected route here.
const PROTECTED_PATH_PREFIXES = [
  '/list-a-sale',
  '/favorites',
  '/saved-searches',
  '/route-planner',
  '/organizer-application',
  '/organizer-dashboard',
  '/create-event',
  '/organizer-event',
];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
        },
      },
    }
  );

  // Do not add code between createServerClient and getUser() — anything
  // that runs a query in between can throw off session refresh and cause
  // users to get randomly logged out (Supabase's own SSR guidance).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtectedPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectTo', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // IMPORTANT: return this exact object — a new NextResponse.next() here
  // would drop the refreshed session cookie set above.
  return supabaseResponse;
}
