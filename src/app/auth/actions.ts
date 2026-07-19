'use server';

import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase-server';
import { TERMS_VERSION } from '@/lib/terms';

export type AuthFormState = { error?: string; info?: string } | undefined;

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

function redirectTargetFrom(formData: FormData): string {
  const value = formData.get('redirectTo');
  return typeof value === 'string' && value.startsWith('/') ? value : '/';
}

// After any successful sign-in, checks whether this account still needs to
// accept the current Terms of Service — true for a first-time Google
// sign-in (no options.data hook the way email/password signUp() has) or an
// account created before terms tracking existed. Mirrors the mobile app's
// currentUserNeedsTermsAcceptance, just inlined since only this file needs it.
async function redirectPastTermsGate(redirectTo: string): Promise<never> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase.from('users').select('terms_accepted_at').eq('id', user.id).maybeSingle();
    if (profile && profile.terms_accepted_at === null) {
      redirect(`/accept-terms?redirectTo=${encodeURIComponent(redirectTo)}`);
    }
  }

  redirect(redirectTo);
}

export async function login(_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return { error: 'Enter your email and password.' };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  await redirectPastTermsGate(redirectTargetFrom(formData));
}

export async function register(_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const acceptedTerms = formData.get('acceptedTerms') === 'on';

  if (!email || !password) return { error: 'Enter your email and password.' };
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' };
  if (!acceptedTerms) return { error: 'You need to agree to the Terms of Service and Privacy Policy to continue.' };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        terms_accepted_at: new Date().toISOString(),
        terms_version: TERMS_VERSION,
      },
    },
  });
  if (error) return { error: error.message };

  // No session yet means the project requires email confirmation — there's
  // nothing to redirect into until they click that link, so this is the
  // success state, not an error.
  if (!data.session) {
    return { info: 'Check your email to confirm your account, then log in.' };
  }

  redirect(redirectTargetFrom(formData));
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  const redirectTo = redirectTargetFrom(formData);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${siteUrl}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}` },
  });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect(data.url);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}

export async function acceptTerms(_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (formData.get('acceptedTerms') !== 'on') {
    return { error: 'You need to agree to the Terms of Service and Privacy Policy to continue.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('users')
    .update({ terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION })
    .eq('id', user.id);
  if (error) return { error: error.message };

  redirect(redirectTargetFrom(formData));
}
