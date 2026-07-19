import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ListASaleForm } from '@/components/list-a-sale/list-a-sale-form';
import { createClient } from '@/lib/supabase-server';

export const metadata: Metadata = { title: 'List a sale' };

export default async function ListASalePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Belt-and-suspenders — middleware already redirects unauthenticated
  // requests to /list-a-sale, this just keeps the page safe standalone too.
  if (!user) redirect('/login?redirectTo=/list-a-sale');

  return <ListASaleForm userId={user.id} />;
}
