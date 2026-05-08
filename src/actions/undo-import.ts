'use server';
import { createServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function undoStudentImport(
  pairs: { class_id: string; student_id: string }[]
): Promise<{ success: boolean; error?: string }> {
  if (pairs.length === 0) return { success: true };

  const supabase = createServerClient();

  // Group by class_id to batch the deletes
  const byClass = new Map<string, string[]>();
  for (const p of pairs) {
    if (!byClass.has(p.class_id)) byClass.set(p.class_id, []);
    byClass.get(p.class_id)!.push(p.student_id);
  }

  for (const [classId, studentIds] of byClass) {
    const { error } = await supabase
      .from('class_students')
      .delete()
      .eq('class_id', classId)
      .in('student_id', studentIds);
    if (error) return { success: false, error: error.message };
  }

  revalidatePath('/admin/classes');
  return { success: true };
}

export async function undoClassCreation(
  classIds: string[]
): Promise<{ success: boolean; error?: string }> {
  if (classIds.length === 0) return { success: true };

  const supabase = createServerClient();

  // Remove students from these classes first
  const { error: csErr } = await supabase
    .from('class_students')
    .delete()
    .in('class_id', classIds);
  if (csErr) return { success: false, error: csErr.message };

  await supabase.from('student_requests').update({ class_id: null }).in('class_id', classIds);

  const { error } = await supabase.from('classes').delete().in('id', classIds);
  if (error) return { success: false, error: error.message };

  revalidatePath('/admin/classes');
  return { success: true };
}
