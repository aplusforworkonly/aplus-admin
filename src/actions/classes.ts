'use server';
import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';

export async function createClass(data: {
  name: string;
  campus: string;
  teacher_id: string | null;
  category: string;
  program_track: string | null;
  course_id: string | null;
  academic_year: string | null;
  term: string | null;
}) {
  const supabase = createServerClient();
  const { error } = await supabase.from('classes').insert(data);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/classes');
  revalidatePath('/admin/classes/matrix');
}

export async function updateClassInfo(
  classId: string,
  data: { name?: string; teacher_id?: string | null }
) {
  const supabase = createServerClient();
  const { error } = await supabase.from('classes').update(data).eq('id', classId);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/classes/matrix');
  revalidatePath('/admin/classes');
}

export async function toggleClassStatus(id: string, status: 'active' | 'archived') {
  const supabase = createServerClient();
  const { error } = await supabase.from('classes').update({ status }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/classes');
}

export async function cloneClass(
  sourceId: string,
  data: {
    name: string;
    campus: string;
    category: string;
    program_track: string | null;
    teacher_id: string | null;
    academic_year: string | null;
    term: string | null;
  }
) {
  const supabase = createServerClient();
  const { data: newClass, error } = await supabase
    .from('classes')
    .insert(data)
    .select('id')
    .single();
  if (error || !newClass) throw new Error(error?.message ?? 'Failed to create class');

  const { data: sourceStudents } = await supabase
    .from('class_students')
    .select('student_id')
    .eq('class_id', sourceId);

  if (sourceStudents && sourceStudents.length > 0) {
    await supabase.from('class_students').insert(
      sourceStudents.map((s) => ({ class_id: newClass.id, student_id: s.student_id }))
    );
  }

  revalidatePath('/admin/classes');
  return newClass.id;
}

export async function deleteClass(id: string) {
  const supabase = createServerClient();
  await supabase.from('class_students').delete().eq('class_id', id);
  await supabase.from('student_requests').update({ class_id: null }).eq('class_id', id);
  const { error } = await supabase.from('classes').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/classes');
  revalidatePath('/admin/classes/matrix');
}

export async function updateClassStudents(classId: string, studentIds: string[]) {
  const supabase = createServerClient();
  await supabase.from('class_students').delete().eq('class_id', classId);
  if (studentIds.length > 0) {
    await supabase.from('class_students').insert(
      studentIds.map((sid) => ({ class_id: classId, student_id: sid }))
    );
  }
  revalidatePath(`/admin/classes/${classId}`);
}

export async function saveRosterAssignments(
  courseIds: string | string[],
  assignments: { studentId: string; classId: string | null }[]
) {
  const supabase = createServerClient();
  const ids = Array.isArray(courseIds) ? courseIds : [courseIds];

  const { data: classes } = await supabase
    .from('classes')
    .select('id')
    .in('course_id', ids)
    .eq('status', 'active');

  const classIds = (classes ?? []).map((c) => c.id);
  const studentIds = assignments.map((a) => a.studentId);

  if (classIds.length > 0 && studentIds.length > 0) {
    await supabase
      .from('class_students')
      .delete()
      .in('class_id', classIds)
      .in('student_id', studentIds);
  }

  const toInsert = assignments
    .filter((a) => a.classId !== null)
    .map((a) => ({ class_id: a.classId!, student_id: a.studentId }));

  if (toInsert.length > 0) {
    const { error } = await supabase.from('class_students').insert(toInsert);
    if (error) throw new Error(error.message);
  }

  revalidatePath('/admin/classes/matrix');
  revalidatePath('/admin/classes');
}
