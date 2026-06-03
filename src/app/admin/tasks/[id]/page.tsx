import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TaskTypeBadge } from '@/components/tasks/TaskTypeBadge';
import { TaskStatusBadge } from '@/components/tasks/TaskStatusBadge';
import { SubTaskList } from '@/components/tasks/SubTaskList';
import { TaskDetailActions } from '@/components/tasks/TaskDetailActions';

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServerClient();

  const [{ data: task }, { data: subTasks }, { data: teachers }] = await Promise.all([
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
    supabase.from('teachers').select('id, name').eq('status', 'active').order('name'),
  ]);

  if (!task) notFound();

  const priorityLabel: Record<string, string> = { urgent: '🔴 緊急', normal: '⚪ 一般', low: '🔵 低優先' };
  const sourceLabel: Record<string, string> = {
    leave_request: '請假申請',
    student_request: '課程異動申請',
    student_review: '資料審核申請',
    routine: '例行任務',
    manual: '手動建立',
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <Link href="/admin/tasks">
          <Button variant="ghost" size="sm">← 返回任務清單</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <TaskTypeBadge type={task.task_type} />
                <TaskStatusBadge status={task.status} />
              </div>
              <CardTitle className="text-xl">{task.title}</CardTitle>
              {task.description && (
                <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">優先級：</span>
              <span className="font-medium">{priorityLabel[task.priority] ?? task.priority}</span>
            </div>
            <div>
              <span className="text-muted-foreground">量能：</span>
              <span className="font-medium">{task.size ?? '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">負責人：</span>
              <span className="font-medium">{(task as any).assigned_teacher?.name ?? '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">校區：</span>
              <span className="font-medium">{task.campus?.join('、') || '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">截止日期：</span>
              <span className="font-medium">{task.due_date ?? '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">任務來源：</span>
              <span className="font-medium">{sourceLabel[task.task_source] ?? task.task_source}</span>
            </div>
            {task.completed_at && (
              <div>
                <span className="text-muted-foreground">完成時間：</span>
                <span className="font-medium">{new Date(task.completed_at).toLocaleString('zh-TW')}</span>
              </div>
            )}
          </div>

          <TaskDetailActions task={task as any} teachers={teachers ?? []} />
        </CardContent>
      </Card>

      {/* 子任務區塊（僅限專案任務顯示） */}
      {task.task_type === 'project' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">子任務拆解</CardTitle>
              <TaskDetailActions
                task={task as any}
                teachers={teachers ?? []}
                showAddSubtask
              />
            </div>
          </CardHeader>
          <CardContent>
            <SubTaskList subTasks={(subTasks ?? []) as any} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
