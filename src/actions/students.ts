'use server';
import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import type { StudentStatus, ProgramType } from '@/lib/supabase/types';

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export type StudentPayload = {
  name: string;
  english_name: string | null;
  birth_date: string | null;
  id_number: string | null;
  enrollment_date: string;
  status: StudentStatus;
  campus: string | null;
  is_school_student: boolean;
  program_type: ProgramType | null;
  main_tutor_id: string | null;
};

export type ConflictResult =
  | { status: 'clear' }
  | { status: 'exists'; studentId: string }
  | { status: 'conflict'; parentId: string; parentPhone: string; existingStudents: { id: string; name: string; english_name: string | null }[] };

export async function checkStudentConflict(name: string, parentPhone: string): Promise<ConflictResult> {
  const supabase = createServerClient();
  const normalized = normalizePhone(parentPhone);
  if (!normalized) return { status: 'clear' };

  // Fetch all parents and normalize phone for comparison in JS
  const { data: parents } = await supabase
    .from('parents')
    .select('id, phone');

  const matched = (parents ?? []).find(
    (p) => normalizePhone(p.phone ?? '') === normalized
  );
  if (!matched) return { status: 'clear' };

  const { data: mappings } = await supabase
    .from('parent_student_mapping')
    .select('students(id, name, english_name)')
    .eq('parent_id', matched.id);

  const existingStudents: { id: string; name: string; english_name: string | null }[] = (mappings ?? [])
    .map((m: any) => m.students)
    .filter(Boolean);

  if (existingStudents.length === 0) return { status: 'clear' };

  const exact = existingStudents.find((s) => s.name === name);
  if (exact) return { status: 'exists', studentId: exact.id };

  return {
    status: 'conflict',
    parentId: matched.id,
    parentPhone: matched.phone,
    existingStudents,
  };
}

export async function renameStudent(id: string, name: string) {
  const supabase = createServerClient();
  const { error } = await supabase.from('students').update({ name }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/students');
  revalidatePath(`/students/${id}`);
}

export async function createStudentWithSiblingLink(
  data: StudentPayload,
  parentId: string,
  relationship: '父' | '母' | '其他'
): Promise<string> {
  const supabase = createServerClient();
  const { data: student, error: sErr } = await supabase
    .from('students')
    .insert(data)
    .select('id')
    .single();
  if (sErr) throw new Error(sErr.message);

  const { error: mErr } = await supabase
    .from('parent_student_mapping')
    .insert({ student_id: student.id, parent_id: parentId, relationship });
  if (mErr) throw new Error(mErr.message);

  revalidatePath('/students');
  return student.id;
}

export async function createStudentAndParent(data: StudentPayload, parentPhone: string): Promise<string> {
  const supabase = createServerClient();

  const { data: parent, error: pErr } = await supabase
    .from('parents')
    .insert({ phone: parentPhone })
    .select('id')
    .single();
  if (pErr) throw new Error(pErr.message);

  const { data: student, error: sErr } = await supabase
    .from('students')
    .insert(data)
    .select('id')
    .single();
  if (sErr) throw new Error(sErr.message);

  const { error: mErr } = await supabase
    .from('parent_student_mapping')
    .insert({ student_id: student.id, parent_id: parent.id, relationship: '其他' });
  if (mErr) throw new Error(mErr.message);

  revalidatePath('/students');
  return student.id;
}

export async function updateStudent(id: string, data: StudentPayload) {
  const supabase = createServerClient();
  const { error } = await supabase.from('students').update(data).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/students');
  revalidatePath(`/students/${id}`);
}

export async function createStudent(data: StudentPayload) {
  const supabase = createServerClient();
  const { data: student, error } = await supabase
    .from('students')
    .insert(data)
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  revalidatePath('/students');
  return student.id;
}

export async function deactivateStudent(id: string) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from('students')
    .update({ status: '已離校' })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/students');
}

export async function batchAssignTutors(
  assignments: { studentId: string; tutorId: string | null; programType?: string | null }[]
) {
  const supabase = createServerClient();
  await Promise.all(
    assignments.map((a) => {
      const update: Record<string, unknown> = { main_tutor_id: a.tutorId || null };
      if ('programType' in a) update.program_type = a.programType || null;
      return supabase.from('students').update(update).eq('id', a.studentId);
    })
  );
  revalidatePath('/admin/roster');
}
