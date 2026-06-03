'use server';
import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import type { TaskSource } from '@/lib/supabase/types';

export async function listRoutingRules() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('task_routing_rules')
    .select('*, assigned_teacher:teachers!assigned_to(id, name, campus, department)')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createRoutingRule(input: {
  campus?: string | null;
  taskSource?: TaskSource | null;
  gradeFrom?: number | null;
  gradeTo?: number | null;
  assignedTo: string;
  priority?: number;
}): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase.from('task_routing_rules').insert({
    campus: input.campus ?? null,
    task_source: input.taskSource ?? null,
    grade_from: input.gradeFrom ?? null,
    grade_to: input.gradeTo ?? null,
    assigned_to: input.assignedTo,
    priority: input.priority ?? 0,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/admin/task-routing');
}

export async function updateRoutingRule(id: string, input: {
  campus?: string | null;
  taskSource?: TaskSource | null;
  gradeFrom?: number | null;
  gradeTo?: number | null;
  assignedTo?: string;
  priority?: number;
}): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase
    .from('task_routing_rules')
    .update({
      ...(input.campus !== undefined && { campus: input.campus }),
      ...(input.taskSource !== undefined && { task_source: input.taskSource }),
      ...(input.gradeFrom !== undefined && { grade_from: input.gradeFrom }),
      ...(input.gradeTo !== undefined && { grade_to: input.gradeTo }),
      ...(input.assignedTo !== undefined && { assigned_to: input.assignedTo }),
      ...(input.priority !== undefined && { priority: input.priority }),
    })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/task-routing');
}

export async function toggleRoutingRuleActive(id: string, isActive: boolean): Promise<void> {
  const supabase = createServerClient();
  await supabase.from('task_routing_rules').update({ is_active: isActive }).eq('id', id);
  revalidatePath('/admin/task-routing');
}

export async function deleteRoutingRule(id: string): Promise<void> {
  const supabase = createServerClient();
  await supabase.from('task_routing_rules').delete().eq('id', id);
  revalidatePath('/admin/task-routing');
}

/**
 * 根據學生資訊與任務來源，查詢最高優先的命中規則，回傳負責老師 ID。
 * 若無命中規則，回傳該校區的學務主管 ID 作為兜底（絕不回傳 null）。
 *
 * SQL 比對條件（防呆處理單邊留空）：
 *   (campus = :campus OR campus IS NULL)
 *   AND (task_source = :source OR task_source IS NULL)
 *   AND (grade_from IS NULL OR grade_from <= :grade)
 *   AND (grade_to   IS NULL OR grade_to   >= :grade)
 */
export async function resolveAssignedTo(
  campus: string,
  taskSource: TaskSource,
  gradeNumber: number
): Promise<string | null> {
  const supabase = createServerClient();

  // 查詢命中規則（四個條件嚴格比對，單邊 NULL 防呆）
  const { data: rules } = await supabase
    .from('task_routing_rules')
    .select('assigned_to, priority')
    .eq('is_active', true)
    .or(`campus.eq.${campus},campus.is.null`)
    .or(`task_source.eq.${taskSource},task_source.is.null`)
    .or(`grade_from.is.null,grade_from.lte.${gradeNumber}`)
    .or(`grade_to.is.null,grade_to.gte.${gradeNumber}`)
    .order('priority', { ascending: false })
    .limit(1);

  if (rules && rules.length > 0) return rules[0].assigned_to;

  // 兜底：找該校區的學務主管
  const { data: supervisor } = await supabase
    .from('teachers')
    .select('id')
    .eq('campus', campus)
    .eq('department', '學務部')
    .eq('is_supervisor', true)
    .eq('status', '在職')
    .limit(1)
    .single();

  if (supervisor) return supervisor.id;

  // 最後兜底：找任何一個該校區的學務部老師
  const { data: anyAcademic } = await supabase
    .from('teachers')
    .select('id')
    .eq('campus', campus)
    .eq('department', '學務部')
    .eq('status', '在職')
    .limit(1)
    .single();

  return anyAcademic?.id ?? null;
}
