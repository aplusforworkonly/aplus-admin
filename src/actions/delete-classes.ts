'use server';
import { createServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function batchDeleteClasses(
  classIds: string[]
): Promise<{ deleted: number; error?: string }> {
  if (classIds.length === 0) return { deleted: 0 };

  const supabase = createServerClient();

  const { error: csErr } = await supabase
    .from('class_students')
    .delete()
    .in('class_id', classIds);
  if (csErr) return { deleted: 0, error: csErr.message };

  await supabase
    .from('student_requests')
    .update({ class_id: null })
    .in('class_id', classIds);

  const { data, error } = await supabase
    .from('classes')
    .delete()
    .in('id', classIds)
    .select('id');
  if (error) return { deleted: 0, error: error.message };

  revalidatePath('/admin/classes');
  return { deleted: data?.length ?? 0 };
}
