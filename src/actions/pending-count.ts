'use server';
import { createServerClient } from '@/lib/supabase/server';

export async function getPendingCounts(): Promise<{ leaves: number; requests: number; studentReviews: number; adminTasks: number }> {
  const supabase = createServerClient();
  const [{ count: leaves }, { count: requests }, { count: reviewRequests }, { count: pendingTasks }, { data: activeStudents }] = await Promise.all([
    supabase.from('leave_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('student_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('student_review_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('admin_tasks').select('*', { count: 'exact', head: true }).in('status', ['pending', 'in_progress']),
    supabase.from('students')
      .select('id, name, english_name, parent_student_mapping(parent_id)')
      .eq('status', '就讀中')
      .not('english_name', 'is', null),
  ]);

  // 1. 同名同英文名重複群組（儲存 ID 列表以供後續排除）
  const nameGroups = new Map<string, string[]>();
  for (const s of activeStudents ?? []) {
    const key = `${(s as any).name}||${(s as any).english_name}`;
    if (!nameGroups.has(key)) nameGroups.set(key, []);
    nameGroups.get(key)!.push((s as any).id);
  }
  const duplicateGroups = [...nameGroups.values()].filter((ids) => ids.length > 1).length;

  // 2. 同家長同英文名（不同中文名）— 透過嵌入關聯取得 parent_id，不另查整張表
  const parentEnGroups = new Map<string, Set<string>>();
  for (const s of activeStudents ?? []) {
    const id = (s as any).id as string;
    const en = (s as any).english_name as string;
    for (const m of ((s as any).parent_student_mapping ?? [])) {
      const key = `${m.parent_id}||${en}`;
      if (!parentEnGroups.has(key)) parentEnGroups.set(key, new Set());
      parentEnGroups.get(key)!.add(id);
    }
  }
  const sameParentDupGroups = [...parentEnGroups.values()]
    .filter((idSet) => {
      if (idSet.size < 2) return false;
      // 相異中文名數量 > 1 才計入（同名已由 duplicateGroups 計算）
      const nameSet = new Set(
        [...idSet].map((id) => {
          const s = (activeStudents ?? []).find((x: any) => x.id === id) as any;
          return s?.name ?? '';
        })
      );
      return nameSet.size > 1;
    }).length;

  return {
    leaves: leaves ?? 0,
    requests: requests ?? 0,
    studentReviews: (reviewRequests ?? 0) + duplicateGroups + sameParentDupGroups,
    adminTasks: pendingTasks ?? 0,
  };
}
