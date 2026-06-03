'use server';
import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { getGradeNumber } from '@/lib/grade';
import { resolveAssignedTo } from '@/actions/task-routing-rules';
import type { TaskStatus, TaskType, TaskSource, TaskPriority, TaskSize } from '@/lib/supabase/types';

// ────────────────────────────────────────────────────────────
// Internal helpers
// ────────────────────────────────────────────────────────────

type SupabaseClient = ReturnType<typeof createServerClient>;

async function syncParentStatus(supabase: SupabaseClient, parentId: string, childNewStatus: TaskStatus) {
  if (childNewStatus === 'completed') {
    // 全部子任務都完成時，主任務自動完成
    const { count } = await supabase
      .from('admin_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', parentId)
      .neq('status', 'completed');
    if (count === 0) {
      await supabase
        .from('admin_tasks')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', parentId);
    }
  } else {
    // 子任務被重新打開時，若主任務已完成則退回 pending
    await supabase
      .from('admin_tasks')
      .update({ status: 'pending', completed_at: null })
      .eq('id', parentId)
      .eq('status', 'completed');
  }
}

// ────────────────────────────────────────────────────────────
// Public: 供其他 action 呼叫（審核流程產生任務）
// ────────────────────────────────────────────────────────────

export async function createAdminTask(input: {
  title: string;
  description?: string;
  taskType?: TaskType;
  taskSource?: TaskSource;
  sourceId?: string;
  parentId?: string;
  campus?: string[];
  priority?: TaskPriority;
  size?: TaskSize;
  dueDate?: string;
  assignedTo?: string;
  createdBy?: string;
}): Promise<string | null> {
  const supabase = createServerClient();

  // 自動指派：若呼叫端未傳 assignedTo，嘗試從路由規則比對
  let assignedTo = input.assignedTo ?? null;
  if (!assignedTo && input.sourceId && input.taskSource && input.taskSource !== 'manual') {
    assignedTo = await autoResolveAssignedTo(supabase, input.taskSource, input.sourceId, input.campus?.[0]);
  }

  const { data, error } = await supabase
    .from('admin_tasks')
    .insert({
      title: input.title,
      description: input.description ?? null,
      task_type: input.taskType ?? 'adhoc',
      task_source: input.taskSource ?? 'manual',
      source_id: input.sourceId ?? null,
      parent_id: input.parentId ?? null,
      campus: input.campus ?? null,
      priority: input.priority ?? 'normal',
      size: input.size ?? 'S',
      due_date: input.dueDate ?? null,
      assigned_to: assignedTo,
      created_by: input.createdBy ?? null,
    })
    .select('id')
    .single();
  if (error) {
    console.error('[createAdminTask]', error.message);
    return null;
  }
  revalidatePath('/admin/tasks');
  return data.id;
}

/**
 * 根據來源審核單查出學生資訊，再透過路由規則找負責人。
 * 設計為靜默失敗：任何步驟出錯都只回傳 null，不拋例外。
 */
async function autoResolveAssignedTo(
  supabase: SupabaseClient,
  taskSource: TaskSource,
  sourceId: string,
  campus?: string
): Promise<string | null> {
  try {
    // 各來源對應不同的表
    const sourceTableMap: Partial<Record<TaskSource, string>> = {
      leave_request:   'leave_requests',
      student_request: 'student_requests',
      student_review:  'student_review_requests',
    };
    const table = sourceTableMap[taskSource];
    if (!table) return null;

    // 取得 student_id
    const { data: sourceRow } = await (supabase.from(table as any) as any)
      .select('student_id')
      .eq('id', sourceId)
      .single();
    const studentId = sourceRow?.student_id;
    if (!studentId) return null;

    // 取得學生的校區與入學日期
    const { data: student } = await supabase
      .from('students')
      .select('campus, enrollment_date')
      .eq('id', studentId)
      .single();
    if (!student) return null;

    const studentCampus: string = student.campus ?? campus ?? '';
    if (!studentCampus || !student.enrollment_date) return null;

    const gradeNumber = getGradeNumber(student.enrollment_date);
    return await resolveAssignedTo(studentCampus, taskSource, gradeNumber);
  } catch {
    return null;
  }
}

/**
 * 審核完成（核准或退回）後，自動把對應的待辦任務結案。
 * 設計為靜默失敗：不拋例外，不影響主流程。
 */
export async function resolveTaskBySourceId(sourceId: string): Promise<void> {
  const supabase = createServerClient();
  await supabase
    .from('admin_tasks')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('source_id', sourceId)
    .in('status', ['pending', 'in_progress']);
}

// ────────────────────────────────────────────────────────────
// CRUD for manual task management
// ────────────────────────────────────────────────────────────

export async function updateTaskStatus(id: string, status: TaskStatus): Promise<void> {
  const supabase = createServerClient();
  const now = new Date().toISOString();

  const { data: task } = await supabase
    .from('admin_tasks')
    .select('parent_id, status')
    .eq('id', id)
    .single();

  await supabase
    .from('admin_tasks')
    .update({
      status,
      completed_at: status === 'completed' ? now : null,
    })
    .eq('id', id);

  // 雙向父子聯動
  if (task?.parent_id) {
    await syncParentStatus(supabase, task.parent_id, status);
  }

  revalidatePath('/admin/tasks');
}

export async function updateTask(id: string, data: {
  title?: string;
  description?: string | null;
  assignedTo?: string | null;
  campus?: string[] | null;
  priority?: TaskPriority;
  size?: TaskSize | null;
  dueDate?: string | null;
}): Promise<void> {
  const supabase = createServerClient();
  await supabase
    .from('admin_tasks')
    .update({
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.assignedTo !== undefined && { assigned_to: data.assignedTo }),
      ...(data.campus !== undefined && { campus: data.campus }),
      ...(data.priority !== undefined && { priority: data.priority }),
      ...(data.size !== undefined && { size: data.size }),
      ...(data.dueDate !== undefined && { due_date: data.dueDate }),
    })
    .eq('id', id);
  revalidatePath('/admin/tasks');
}

export async function deleteTask(id: string): Promise<void> {
  const supabase = createServerClient();
  await supabase.from('admin_tasks').delete().eq('id', id);
  revalidatePath('/admin/tasks');
}

export async function listTasks(filters?: {
  status?: TaskStatus;
  taskType?: TaskType;
  campus?: string;
  assignedTo?: string;
  parentId?: string | null;
}) {
  const supabase = createServerClient();
  let query = supabase
    .from('admin_tasks')
    .select(`
      *,
      assigned_teacher:teachers!assigned_to(id, name)
    `)
    .is('parent_id', null)
    .order('priority', { ascending: true })
    .order('due_date', { ascending: true, nullsFirst: false });

  if (filters?.status)    query = query.eq('status', filters.status);
  if (filters?.taskType)  query = query.eq('task_type', filters.taskType);
  if (filters?.assignedTo) query = query.eq('assigned_to', filters.assignedTo);
  if (filters?.campus)    query = query.contains('campus', [filters.campus]);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getTaskWithSubtasks(id: string) {
  const supabase = createServerClient();
  const [{ data: task }, { data: subTasks }] = await Promise.all([
    supabase
      .from('admin_tasks')
      .select('*, assigned_teacher:teachers!assigned_to(id, name)')
      .eq('id', id)
      .single(),
    supabase
      .from('admin_tasks')
      .select('*, assigned_teacher:teachers!assigned_to(id, name)')
      .eq('parent_id', id)
      .order('created_at', { ascending: true }),
  ]);
  if (!task) return null;
  return { ...task, sub_tasks: subTasks ?? [] };
}
