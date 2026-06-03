'use server';
import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import type { FrequencyType, TaskPriority, TaskSize } from '@/lib/supabase/types';

export async function listRoutineDefinitions() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('routine_definitions')
    .select('*, assigned_teacher:teachers!assigned_to(id, name)')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createRoutineDefinition(input: {
  title: string;
  description?: string;
  frequencyType: FrequencyType;
  frequencyValue?: number;
  advanceDays?: number;
  campus?: string[];
  assignedTo?: string;
  size?: TaskSize;
  priority?: TaskPriority;
  createdBy?: string;
}): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase.from('routine_definitions').insert({
    title: input.title,
    description: input.description ?? null,
    frequency_type: input.frequencyType,
    frequency_value: input.frequencyValue ?? null,
    advance_days: input.advanceDays ?? 0,
    campus: input.campus ?? null,
    assigned_to: input.assignedTo ?? null,
    size: input.size ?? 'S',
    priority: input.priority ?? 'normal',
    created_by: input.createdBy ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/admin/routines');
}

export async function updateRoutineDefinition(id: string, input: {
  title?: string;
  description?: string | null;
  frequencyType?: FrequencyType;
  frequencyValue?: number | null;
  advanceDays?: number;
  campus?: string[] | null;
  assignedTo?: string | null;
  size?: TaskSize;
  priority?: TaskPriority;
}): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase
    .from('routine_definitions')
    .update({
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.frequencyType !== undefined && { frequency_type: input.frequencyType }),
      ...(input.frequencyValue !== undefined && { frequency_value: input.frequencyValue }),
      ...(input.advanceDays !== undefined && { advance_days: input.advanceDays }),
      ...(input.campus !== undefined && { campus: input.campus }),
      ...(input.assignedTo !== undefined && { assigned_to: input.assignedTo }),
      ...(input.size !== undefined && { size: input.size }),
      ...(input.priority !== undefined && { priority: input.priority }),
    })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/routines');
}

export async function toggleRoutineActive(id: string, isActive: boolean): Promise<void> {
  const supabase = createServerClient();
  await supabase.from('routine_definitions').update({ is_active: isActive }).eq('id', id);
  revalidatePath('/admin/routines');
}

export async function deleteRoutineDefinition(id: string): Promise<void> {
  const supabase = createServerClient();
  await supabase.from('routine_definitions').delete().eq('id', id);
  revalidatePath('/admin/routines');
}
