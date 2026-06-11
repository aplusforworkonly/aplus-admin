'use server';
import { createServerClient, createSessionClient } from '@/lib/supabase/server';

export async function getHandledBy(supabase: ReturnType<typeof createServerClient>): Promise<string | null> {
  try {
    const sessionClient = await createSessionClient();
    const { data: { user } } = await sessionClient.auth.getUser();
    if (!user) return null;
    const { data: t } = await supabase.from('teachers').select('id').eq('user_id', user.id).single();
    return t?.id ?? null;
  } catch {
    return null;
  }
}
