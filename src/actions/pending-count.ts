'use server';
import { createServerClient } from '@/lib/supabase/server';

export async function getPendingCounts(): Promise<{ leaves: number; requests: number; studentReviews: number }> {
  const supabase = createServerClient();
  const [{ count: leaves }, { count: requests }, { count: reviewRequests }, { data: activeStudents }] = await Promise.all([
    supabase.from('leave_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('student_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('student_review_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('students').select('name, english_name').eq('status', '就讀中').not('english_name', 'is', null),
  ]);

  // Count duplicate-name groups (same name + english_name = likely same student entered twice)
  const groups = new Map<string, number>();
  for (const s of activeStudents ?? []) {
    const key = `${(s as any).name}||${(s as any).english_name}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  const duplicateGroups = [...groups.values()].filter((n) => n > 1).length;

  return {
    leaves: leaves ?? 0,
    requests: requests ?? 0,
    studentReviews: (reviewRequests ?? 0) + duplicateGroups,
  };
}
