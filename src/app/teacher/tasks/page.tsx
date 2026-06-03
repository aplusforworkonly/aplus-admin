import { redirect } from 'next/navigation';
import { createSessionClient, createServerClient } from '@/lib/supabase/server';
import { getTeacherByUser } from '@/lib/get-teacher';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { TeacherTaskView } from '@/components/tasks/TeacherTaskView';

export default async function TeacherTasksPage() {
  const session = await createSessionClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) redirect('/login');

  const supabase = createServerClient();
  const teacher = await getTeacherByUser(
    supabase, user.id, user.email,
    'id, name, campus, department'
  );
  if (!teacher) redirect('/login');

  // 非學務部老師顯示提示畫面
  if ((teacher as any).department !== '學務部') {
    return (
      <div className="p-6 max-w-lg mx-auto mt-12">
        <Alert variant="warning">
          <AlertTitle>目前開放學務部使用</AlertTitle>
          <AlertDescription>
            任務管理功能目前僅開放學務部老師使用，其他部門將陸續開放。
            如有疑問請聯繫學務主管。
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // 查詢指派給此老師的所有未完成任務
  const { data: tasks } = await supabase
    .from('admin_tasks')
    .select('*')
    .eq('assigned_to', (teacher as any).id)
    .neq('status', 'completed')
    .is('parent_id', null)
    .order('due_date', { ascending: true, nullsFirst: false });

  return (
    <div className="h-[calc(100vh-4rem)]">
      <div className="px-5 py-4 border-b flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">我的任務</h1>
          <p className="text-xs text-muted-foreground">{(teacher as any).name} · {(teacher as any).campus}</p>
        </div>
      </div>
      <TeacherTaskView tasks={(tasks ?? []) as any} />
    </div>
  );
}
