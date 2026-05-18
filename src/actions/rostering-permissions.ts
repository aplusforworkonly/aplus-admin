'use server';
import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';

export async function getTeacherRosteringTabs(teacherId: string): Promise<string[]> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('rostering_permissions')
    .select('tab_key')
    .eq('teacher_id', teacherId);
  return (data ?? []).map((r: any) => r.tab_key as string);
}

export async function toggleRosteringPermission(
  teacherId: string,
  tabKey: string,
  enabled: boolean
) {
  const supabase = createServerClient();
  if (enabled) {
    await supabase
      .from('rostering_permissions')
      .upsert({ teacher_id: teacherId, tab_key: tabKey });
  } else {
    await supabase
      .from('rostering_permissions')
      .delete()
      .eq('teacher_id', teacherId)
      .eq('tab_key', tabKey);
  }
  revalidatePath('/admin/rostering-permissions');
}

export async function toggleCoursePermission(
  teacherId: string,
  tabKey: string,
  courseIds: string[],
  enabled: boolean
) {
  const supabase = createServerClient();
  if (enabled) {
    await supabase
      .from('rostering_course_permissions')
      .upsert(courseIds.map((id) => ({ teacher_id: teacherId, tab_key: tabKey, course_id: id })));
  } else {
    await supabase
      .from('rostering_course_permissions')
      .delete()
      .eq('teacher_id', teacherId)
      .eq('tab_key', tabKey)
      .in('course_id', courseIds);
  }
  revalidatePath(`/admin/rostering-permissions/${teacherId}`);
}

// 取老師在特定分頁的課程限制（null = 無限制，看所有課程）
export async function getTeacherAllowedCourses(
  teacherId: string,
  tabKey: string
): Promise<string[] | null> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('rostering_course_permissions')
    .select('course_id')
    .eq('teacher_id', teacherId)
    .eq('tab_key', tabKey);
  if (!data || data.length === 0) return null;
  return data.map((r: any) => r.course_id as string);
}

// 取所有老師的分班權限（供管理後台用）
export async function getAllRosteringPermissions(): Promise<
  { teacherId: string; tabs: string[] }[]
> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('rostering_permissions')
    .select('teacher_id, tab_key');

  const map = new Map<string, string[]>();
  for (const row of data ?? []) {
    const tid = (row as any).teacher_id as string;
    const tab = (row as any).tab_key as string;
    if (!map.has(tid)) map.set(tid, []);
    map.get(tid)!.push(tab);
  }
  return [...map.entries()].map(([teacherId, tabs]) => ({ teacherId, tabs }));
}
