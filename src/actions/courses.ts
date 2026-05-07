'use server';
import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import type { CourseType, BillingCycle } from '@/lib/supabase/types';

type CoursePayload = {
  name: string;
  course_type: CourseType;
  billing_cycle: BillingCycle;
  base_price: number;
  max_capacity: number | null;
  is_overnight: boolean;
};

export async function createCourse(data: CoursePayload) {
  const supabase = createServerClient();
  const { data: course, error } = await supabase
    .from('courses')
    .insert(data)
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  revalidatePath('/courses');
  return course.id;
}

export async function updateCourse(id: string, data: CoursePayload) {
  const supabase = createServerClient();
  const { error } = await supabase.from('courses').update(data).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/courses');
  revalidatePath(`/courses/${id}`);
}
