'use server';
import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import type { EnrollmentStatus } from '@/lib/supabase/types';

export async function updateEnrollmentStatus(id: string, status: EnrollmentStatus) {
  const supabase = createServerClient();
  const { error } = await supabase.from('enrollments').update({ status }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/enrollments');
}

export async function promoteFromWaitlist(id: string) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from('enrollments')
    .update({ status: '生效' })
    .eq('id', id)
    .eq('status', '候補');
  if (error) throw new Error(error.message);
  revalidatePath('/enrollments');
  revalidatePath('/admin/waitlist');
}

export async function approveAllPending() {
  const supabase = createServerClient();
  const { error } = await supabase
    .from('enrollments')
    .update({ status: '生效' })
    .eq('status', '待審核');
  if (error) throw new Error(error.message);
  revalidatePath('/enrollments');
}

export async function deleteAllPendingDuplicates(): Promise<{ deleted: number }> {
  const supabase = createServerClient();

  // 用學生姓名配對，避免同一人有兩筆 student 記錄（student_id 不同）時配不到
  const [{ data: pending }, { data: active }] = await Promise.all([
    supabase
      .from('enrollments')
      .select('id, course_id, students!inner(name)')
      .eq('status', '待審核'),
    supabase
      .from('enrollments')
      .select('course_id, students!inner(name)')
      .eq('status', '生效'),
  ]);

  if (!pending || pending.length === 0) return { deleted: 0 };

  const activeSet = new Set(
    (active ?? []).map((e) => `${(e.students as any).name}:${e.course_id}`)
  );

  const duplicateIds = (pending as any[])
    .filter((e) => activeSet.has(`${e.students.name}:${e.course_id}`))
    .map((e) => e.id as string);

  if (duplicateIds.length === 0) return { deleted: 0 };

  const { error } = await supabase.from('enrollments').delete().in('id', duplicateIds);
  if (error) throw new Error(error.message);

  revalidatePath('/enrollments');
  return { deleted: duplicateIds.length };
}
