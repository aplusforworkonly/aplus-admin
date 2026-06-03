'use client';
import { useTransition } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { TaskStatusBadge } from './TaskStatusBadge';
import { TaskTypeBadge } from './TaskTypeBadge';
import { updateTaskStatus } from '@/actions/admin-tasks';
import type { AdminTask } from '@/lib/supabase/types';

const SOURCE_LINKS: Record<string, string> = {
  leave_request:   '/leaves',
  student_request: '/admin/requests',
  student_review:  '/admin/student-reviews',
};

const SOURCE_LABELS: Record<string, string> = {
  leave_request:   '請假申請',
  student_request: '課程異動申請',
  student_review:  '資料審核申請',
  routine:         '例行任務',
  manual:          '手動指派',
};

const SIZE_LABELS: Record<string, string> = { S: '0.5–1h', M: '2–4h', L: '1天+' };

export function TaskCard({ task }: { task: AdminTask }) {
  const [pending, startTransition] = useTransition();

  const today = new Date().toISOString().split('T')[0];
  const isOverdue = task.due_date && task.due_date < today && task.status !== 'completed';
  const isDueToday = task.due_date === today;
  const sourceLink = SOURCE_LINKS[task.task_source];

  return (
    <div className={`rounded-lg border p-4 bg-card transition-colors hover:bg-accent/20 ${isOverdue ? 'border-red-200 bg-red-50/30' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {/* 標題列 */}
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            {task.priority === 'urgent' && <span className="text-xs text-red-500 font-bold">🔴</span>}
            <TaskTypeBadge type={task.task_type} />
            <TaskStatusBadge status={task.status} />
          </div>

          <Link href={`/admin/tasks/${task.id}`} className="font-medium text-sm hover:underline block mb-2">
            {task.title}
          </Link>

          {/* 中繼資料 */}
          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{SOURCE_LABELS[task.task_source] ?? task.task_source}</span>
            {task.due_date && (
              <span className={isOverdue ? 'text-red-500 font-medium' : isDueToday ? 'text-amber-600 font-medium' : ''}>
                截止 {task.due_date}{isDueToday ? '（今天）' : ''}
              </span>
            )}
            {task.size && <span className="font-mono bg-slate-100 px-1 rounded">{task.size} · {SIZE_LABELS[task.size]}</span>}
          </div>
        </div>

        {/* 操作 */}
        <div className="flex flex-col gap-1.5 shrink-0">
          {task.status !== 'completed' && (
            <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" disabled={pending}
              onClick={() => startTransition(() => updateTaskStatus(task.id, 'completed'))}>
              完成
            </Button>
          )}
          {task.status === 'completed' && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={pending}
              onClick={() => startTransition(() => updateTaskStatus(task.id, 'pending'))}>
              重開
            </Button>
          )}
          {sourceLink && task.task_source !== 'manual' && task.task_source !== 'routine' && (
            <Link href={sourceLink}>
              <Button size="sm" variant="outline" className="h-7 text-xs w-full">
                前往審核 →
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
