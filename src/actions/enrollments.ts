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

export async function approveAllPending() {
  const supabase = createServerClient();
  const { error } = await supabase
    .from('enrollments')
    .update({ status: '生效' })
    .eq('status', '待審核');
  if (error) throw new Error(error.message);
  revalidatePath('/enrollments');
}
