'use server';
import { createServerClient } from '@/lib/supabase/server';

export async function getPendingCounts(): Promise<{ leaves: number; requests: number; studentReviews: number }> {
  const supabase = createServerClient();
  const [{ count: leaves }, { count: requests }, { count: studentReviews }] = await Promise.all([
    supabase.from('leave_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('student_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('student_review_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);
  return { leaves: leaves ?? 0, requests: requests ?? 0, studentReviews: studentReviews ?? 0 };
}
