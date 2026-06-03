'use client';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { TaskStatusBadge } from './TaskStatusBadge';
import { updateTaskStatus } from '@/actions/admin-tasks';
import type { AdminTask } from '@/lib/supabase/types';

export function SubTaskList({ subTasks }: { subTasks: AdminTask[] }) {
  const [pending, startTransition] = useTransition();

  if (subTasks.length === 0) {
    return <p className="text-sm text-muted-foreground">尚未建立子任務</p>;
  }

  const completedCount = subTasks.filter((t) => t.status === 'completed').length;

  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground mb-3">
        進度：{completedCount} / {subTasks.length} 完成
        <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all"
            style={{ width: `${subTasks.length ? (completedCount / subTasks.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {subTasks.map((task) => (
        <div
          key={task.id}
          className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
        >
          <Checkbox
            checked={task.status === 'completed'}
            disabled={pending}
            onCheckedChange={(checked) => {
              startTransition(() =>
                updateTaskStatus(task.id, checked ? 'completed' : 'in_progress')
              );
            }}
            className="mt-0.5"
          />
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
              {task.title}
            </p>
            {task.description && (
              <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>
            )}
            <div className="flex items-center gap-2 mt-1.5">
              <TaskStatusBadge status={task.status} />
              {task.due_date && (
                <span className="text-xs text-muted-foreground">截止 {task.due_date}</span>
              )}
              {task.size && (
                <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                  {task.size}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
