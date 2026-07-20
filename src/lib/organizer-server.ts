import { createClient } from '@/lib/supabase-server';
import type { OrganizerApplication } from '@/lib/organizer-applications';

// Server-Component read path — mirrors src/lib/organizer-applications.ts's
// browser-client reads, just via the server client for initial page render.

export async function getIsVerifiedOrganizer(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('users').select('is_verified_organizer').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data?.is_verified_organizer ?? false;
}

export async function getLatestOrganizerApplication(userId: string): Promise<OrganizerApplication | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('organizer_applications')
    .select('id, full_name, neighborhood, affiliation_notes, status, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    fullName: data.full_name,
    neighborhood: data.neighborhood,
    affiliationNotes: data.affiliation_notes,
    status: data.status,
    createdAt: data.created_at,
  };
}
