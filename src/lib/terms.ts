// Ported from the mobile app's utils/terms-acceptance.ts — same hosted
// documents, same version string, kept in sync by hand since the two
// projects don't share a package. See that file for why signup threads
// terms_accepted_at/terms_version through supabase.auth.signUp()'s
// options.data instead of a direct table update: a direct update would
// silently fail under RLS before a session exists (the "confirm your
// email" pending-signup window has no auth.uid() yet).
export const TERMS_VERSION = '2026-07-11';
export const PRIVACY_POLICY_URL = 'https://adambujold.github.io/garagehunt-legal/';
export const TERMS_OF_SERVICE_URL = 'https://adambujold.github.io/garagehunt-legal/terms.html';
