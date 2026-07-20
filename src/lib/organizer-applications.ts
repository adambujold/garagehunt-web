import { createClient } from '@/lib/supabase-browser';

// Ported from the mobile app's utils/organizer-applications.ts. Approval/
// denial itself is a manual Table Editor edit by design (see the mobile
// repo's 0012_organizer_applications.sql — there's deliberately no UPDATE
// policy on `status`) — this only covers apply/check-status, same as mobile.

export type OrganizerApplicationStatus = 'pending' | 'approved' | 'denied';

export type OrganizerApplication = {
  id: string;
  fullName: string;
  neighborhood: string;
  affiliationNotes: string;
  status: OrganizerApplicationStatus;
  createdAt: string;
};

export async function fetchLatestOrganizerApplication(userId: string): Promise<OrganizerApplication | null> {
  const supabase = createClient();
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

export async function submitOrganizerApplication(input: {
  userId: string;
  fullName: string;
  neighborhood: string;
  affiliationNotes: string;
}): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('organizer_applications').insert({
    user_id: input.userId,
    full_name: input.fullName,
    neighborhood: input.neighborhood,
    affiliation_notes: input.affiliationNotes,
  });
  if (error) throw error;
}
