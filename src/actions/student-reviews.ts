'use server';
import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';

export async function approveStudentReview(id: string) {
  const supabase = createServerClient();

  const { data: review, error } = await supabase
    .from('student_review_requests')
    .select('student_id, proposed_changes')
    .eq('id', id)
    .single();

  if (error || !review) throw new Error('找不到審核資料');

  const changes = review.proposed_changes as Record<string, { old: unknown; new: unknown }>;
  const updates: Record<string, unknown> = {};
  for (const [field, diff] of Object.entries(changes)) {
    updates[field] = diff.new;
  }

  const { error: updateErr } = await supabase
    .from('students')
    .update(updates)
    .eq('id', review.student_id);

  if (updateErr) throw new Error('更新學生資料失敗：' + updateErr.message);

  await supabase
    .from('student_review_requests')
    .update({ status: 'approved', resolved_at: new Date().toISOString() })
    .eq('id', id);

  revalidatePath('/admin/student-reviews');
}

export async function rejectStudentReview(id: string) {
  const supabase = createServerClient();

  await supabase
    .from('student_review_requests')
    .update({ status: 'rejected', resolved_at: new Date().toISOString() })
    .eq('id', id);

  revalidatePath('/admin/student-reviews');
}
