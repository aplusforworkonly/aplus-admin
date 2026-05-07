'use server';
import { createServerClient } from '@/lib/supabase/server';

export async function getPendingCounts(): Promise<{ leaves: number; requests: number; enrollments: number }> {
  const supabase = createServerClient();
  const [{ count: leaves }, { count: requests }, { count: enrollments }] = await Promise.all([
    supabase.from('leave_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('student_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('enrollments').select('*', { count: 'exact', head: true }).eq('status', '待審核'),
  ]);
  return { leaves: leaves ?? 0, requests: requests ?? 0, enrollments: enrollments ?? 0 };
}
