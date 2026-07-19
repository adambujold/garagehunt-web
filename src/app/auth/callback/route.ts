import { NextResponse, type NextRequest } from 'next/server';

import { createClient } from '@/lib/supabase-server';

// Google OAuth lands here with a ?code= to exchange for a session (PKCE
// flow, same as the mobile app's utils/google-auth.ts, just via a real
// redirect instead of expo-web-browser's auth session popup).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const redirectTo = searchParams.get('redirectTo') ?? '/';
  const errorDescription = searchParams.get('error_description');

  if (errorDescription) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errorDescription)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Google sign-in did not return a valid code.')}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  // A first-time Google sign-in has no options.data hook the way
  // supabase.auth.signUp() does (see auth/actions.ts), so terms acceptance
  // can only be checked after the fact, here.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase.from('users').select('terms_accepted_at').eq('id', user.id).maybeSingle();
    if (profile && profile.terms_accepted_at === null) {
      return NextResponse.redirect(`${origin}/accept-terms?redirectTo=${encodeURIComponent(redirectTo)}`);
    }
  }

  return NextResponse.redirect(`${origin}${redirectTo}`);
}
