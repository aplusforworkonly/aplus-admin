import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TaskListClient } from '@/components/tasks/TaskListClient';

export default async function TasksPage() {
  const supabase = createServerClient();

  const [{ data: tasks }, { data: teachers }] = await Promise.all([
    supabase
      .from('admin_tasks')
      .select('*, assigned_teacher:teachers!assigned_to(id, name)')
      .is('parent_id', null)
      .order('priority', { ascending: true })
      .order('due_date', { ascending: true, nullsFirst: false }),
    supabase.from('teachers').select('id, name').eq('status', 'active').order('name'),
  ]);

  // 統計摘要
  const all = tasks ?? [];
  const urgentCount  = all.filter((t) => t.priority === 'urgent' && t.status !== 'completed').length;
  const overdueCount = all.filter((t) =>
    t.due_date && t.status !== 'completed' && t.due_date < new Date().toISOString().split('T')[0]
  ).length;
  const todayCount = all.filter((t) =>
    t.due_date === new Date().toISOString().split('T')[0] && t.status !== 'completed'
  ).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">任務管理</h1>
      </div>

      {/* 統計卡片 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-normal">全部待辦</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">
              {all.filter((t) => t.status !== 'completed').length}
            </p>
          </CardContent>
        </Card>
        <Card className={urgentCount > 0 ? 'border-red-200 bg-red-50/50' : ''}>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-normal">🔴 緊急</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className={`text-2xl font-bold ${urgentCount > 0 ? 'text-red-600' : ''}`}>{urgentCount}</p>
          </CardContent>
        </Card>
        <Card className={overdueCount > 0 ? 'border-red-200 bg-red-50/50' : ''}>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-normal">逾期</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className={`text-2xl font-bold ${overdueCount > 0 ? 'text-red-600' : ''}`}>{overdueCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-normal">今日到期</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{todayCount}</p>
          </CardContent>
        </Card>
      </div>

      <TaskListClient
        tasks={(tasks ?? []) as any}
        teachers={teachers ?? []}
      />
    </div>
  );
}
