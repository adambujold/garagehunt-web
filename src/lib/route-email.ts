import { createClient } from '@/lib/supabase-browser';

export async function emailRouteDirections(stops: { id: string; title: string; addressLabel: string }[], originLabel?: string): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke('send-route-email', {
    body: { stops, originLabel },
  });
  if (error) {
    const context = (error as { context?: { error?: string } }).context;
    throw new Error(context?.error || 'Could not email your route right now.');
  }
  if (!data?.sent) throw new Error('Could not email your route right now.');
}
