'use server';
import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';

export async function addLeave(studentId: string, leaveDate: string, note: string) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from('student_leaves')
    .insert({ student_id: studentId, leave_date: leaveDate, note: note || null });
  if (error) throw new Error(error.message);
  revalidatePath(`/students/${studentId}`);
}

export async function deleteLeave(id: string, studentId: string) {
  const supabase = createServerClient();
  const { error } = await supabase.from('student_leaves').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath(`/students/${studentId}`);
}
