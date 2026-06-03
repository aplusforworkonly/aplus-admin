'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { TaskDialog } from './TaskDialog';
import { updateTaskStatus, deleteTask } from '@/actions/admin-tasks';
import type { AdminTask, TaskStatus } from '@/lib/supabase/types';

interface Props {
  task: AdminTask;
  teachers: { id: string; name: string }[];
  showAddSubtask?: boolean;
}

export function TaskDetailActions({ task, teachers, showAddSubtask }: Props) {
  const [pending, startTransition] = useTransition();
  const [showEdit, setShowEdit] = useState(false);
  const [showAddSub, setShowAddSub] = useState(false);
  const router = useRouter();

  function handleStatusChange(status: TaskStatus) {
    startTransition(async () => {
      await updateTaskStatus(task.id, status);
      router.refresh();
    });
  }

  function handleDelete() {
    if (!confirm('確認刪除這個任務？')) return;
    startTransition(async () => {
      await deleteTask(task.id);
      router.push('/admin/tasks');
    });
  }

  // showAddSubtask=true 時只顯示「新增子任務」按鈕
  if (showAddSubtask) {
    return (
      <>
        <Button size="sm" variant="outline" onClick={() => setShowAddSub(true)}>
          ＋ 新增子任務
        </Button>
        {showAddSub && (
          <TaskDialog
            teachers={teachers}
            parentId={task.id}
            defaultType="adhoc"
            onClose={() => { setShowAddSub(false); router.refresh(); }}
          />
        )}
      </>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 pt-2 border-t">
      {task.status !== 'completed' && (
        <Button size="sm" className="bg-green-600 hover:bg-green-700" disabled={pending}
          onClick={() => handleStatusChange('completed')}>
          標記完成
        </Button>
      )}
      {task.status === 'completed' && (
        <Button size="sm" variant="outline" disabled={pending}
          onClick={() => handleStatusChange('pending')}>
          重新開啟
        </Button>
      )}
      <Button size="sm" variant="outline" disabled={pending} onClick={() => setShowEdit(true)}>
        編輯
      </Button>
      <Button size="sm" variant="outline" className="text-destructive hover:text-destructive"
        disabled={pending} onClick={handleDelete}>
        刪除
      </Button>

      {showEdit && (
        <TaskDialog
          teachers={teachers}
          editTask={task}
          onClose={() => { setShowEdit(false); router.refresh(); }}
        />
      )}
    </div>
  );
}
