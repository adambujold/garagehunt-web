import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { RoutePlannerForm } from '@/components/route-planner-form';
import { createClient } from '@/lib/supabase-server';

export const metadata: Metadata = { title: 'Plan your route' };

export default async function RoutePlannerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Belt-and-suspenders — middleware already redirects unauthenticated
  // requests to /route-planner, this just keeps the page safe standalone too.
  if (!user) redirect('/login?redirectTo=/route-planner');

  return <RoutePlannerForm userId={user.id} />;
}
