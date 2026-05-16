'use server';
import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';

export async function createTeacher(data: {
  name: string;
  email: string;
  campus: string;
  english_name?: string;
  department?: string;
}) {
  const supabase = createServerClient();
  const { error } = await supabase.from('teachers').insert({ ...data, email: data.email.toLowerCase().trim() });
  if (error) throw new Error(error.message);
  revalidatePath('/teachers');
  revalidatePath('/admin/roster');
}

export async function updateTeacher(id: string, data: {
  name: string;
  english_name: string | null;
  email: string;
  campus: string;
  department: string | null;
  status: string;
}) {
  const supabase = createServerClient();
  const { error } = await supabase.from('teachers').update({ ...data, email: data.email.toLowerCase().trim() }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath(`/teachers/${id}`);
  revalidatePath('/teachers');
  revalidatePath('/admin/roster');
}

export async function deleteTeacher(id: string) {
  const supabase = createServerClient();
  const { error } = await supabase.from('teachers').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/teachers');
  revalidatePath('/admin/roster');
}

export async function toggleSupervisor(id: string, value: boolean) {
  const supabase = createServerClient();
  const { error } = await supabase.from('teachers').update({ is_supervisor: value }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/teachers');
}

export async function getSupervisorAccess(supervisorId: string): Promise<string[]> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('supervisor_teacher_access')
    .select('viewable_teacher_id')
    .eq('supervisor_id', supervisorId);
  return (data ?? []).map((r: any) => r.viewable_teacher_id);
}

export async function setSupervisorAccess(supervisorId: string, teacherIds: string[]): Promise<void> {
  const supabase = createServerClient();
  await supabase.from('supervisor_teacher_access').delete().eq('supervisor_id', supervisorId);
  if (teacherIds.length > 0) {
    await supabase.from('supervisor_teacher_access').insert(
      teacherIds.map((id) => ({ supervisor_id: supervisorId, viewable_teacher_id: id }))
    );
  }
  revalidatePath('/teachers');
}

export async function updateTeacherStudents(teacherId: string, studentIds: string[]) {
  const supabase = createServerClient();
  await supabase.from('teacher_student_mapping').delete().eq('teacher_id', teacherId);
  if (studentIds.length > 0) {
    await supabase.from('teacher_student_mapping').insert(
      studentIds.map((sid) => ({ teacher_id: teacherId, student_id: sid }))
    );
  }
  revalidatePath(`/teachers/${teacherId}`);
}
