'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TaskTypeBadge } from './TaskTypeBadge';
import { TaskStatusBadge } from './TaskStatusBadge';
import { TaskDialog } from './TaskDialog';
import { updateTaskStatus, deleteTask } from '@/actions/admin-tasks';
import type { AdminTask, TaskStatus, TaskType } from '@/lib/supabase/types';

const CAMPUSES = ['文府總校', '龍華校', '左新校'];
const TASK_TYPES: { value: TaskType | ''; label: string }[] = [
  { value: '', label: '全部類型' },
  { value: 'project', label: '專案' },
  { value: 'routine', label: '例行' },
  { value: 'adhoc', label: '突發' },
];
const STATUSES: { value: TaskStatus | ''; label: string }[] = [
  { value: '', label: '全部狀態' },
  { value: 'pending', label: '待處理' },
  { value: 'overdue', label: '已逾期' },
  { value: 'completed', label: '已完成' },
];

interface TaskWithTeacher extends AdminTask {
  assigned_teacher?: { id: string; name: string } | null;
}

interface Props {
  tasks: TaskWithTeacher[];
  teachers: { id: string; name: string }[];
}

export function TaskListClient({ tasks, teachers }: Props) {
  const [pending, startTransition] = useTransition();
  const [showDialog, setShowDialog] = useState(false);
  const [filterType, setFilterType] = useState<TaskType | ''>('');
  const [filterStatus, setFilterStatus] = useState<TaskStatus | ''>('');
  const [filterCampus, setFilterCampus] = useState('');
  const [groupByCampus, setGroupByCampus] = useState(false);

  const filtered = tasks.filter((t) => {
    if (filterType && t.task_type !== filterType) return false;
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterCampus && !(t.campus ?? []).includes(filterCampus)) return false;
    return true;
  });

  function renderTaskRow(task: TaskWithTeacher, hideCampus = false) {
    const isOverdue =
      task.due_date && task.status !== 'completed' && task.due_date < new Date().toISOString().split('T')[0];

    return (
      <tr
        key={task.id}
        className={`border-b last:border-0 hover:bg-accent/30 transition-colors ${isOverdue ? 'bg-red-50/50' : ''}`}
      >
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            {task.priority === 'urgent' && <span className="text-red-500 text-xs font-bold">🔴</span>}
            {task.priority === 'low' && <span className="text-blue-400 text-xs">🔵</span>}
            <Link href={`/admin/tasks/${task.id}`} className="font-medium hover:underline text-sm">
              {task.title}
            </Link>
          </div>
        </td>
        <td className="py-3 px-4"><TaskTypeBadge type={task.task_type} /></td>
        <td className="py-3 px-4 text-sm text-muted-foreground">
          {task.assigned_teacher?.name ?? '—'}
        </td>
        {!hideCampus && (
          <td className="py-3 px-4 text-sm text-muted-foreground">
            {task.campus?.join('、') || '—'}
          </td>
        )}
        <td className="py-3 px-4 text-sm">
          {task.due_date ? (
            <span className={isOverdue ? 'text-red-600 font-medium' : ''}>{task.due_date}</span>
          ) : '—'}
        </td>
        <td className="py-3 px-4">
          {task.size && (
            <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">{task.size}</span>
          )}
        </td>
        <td className="py-3 px-4"><TaskStatusBadge status={task.status} /></td>
        <td className="py-3 px-4">
          <div className="flex gap-1">
            {task.status !== 'completed' && (
              <Button size="sm" variant="ghost" className="h-7 text-xs text-green-600" disabled={pending}
                onClick={() => startTransition(() => updateTaskStatus(task.id, 'completed'))}>
                完成
              </Button>
            )}
            {task.status === 'completed' && (
              <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" disabled={pending}
                onClick={() => startTransition(() => updateTaskStatus(task.id, 'pending'))}>
                重開
              </Button>
            )}
          </div>
        </td>
      </tr>
    );
  }

  function renderCampusGroup() {
    const groups: Record<string, TaskWithTeacher[]> = { '不指定': [] };
    CAMPUSES.forEach((c) => { groups[c] = []; });
    filtered.forEach((t) => {
      const c = t.campus?.[0];
      if (c && groups[c]) groups[c].push(t);
      else groups['不指定'].push(t);
    });

    const today = new Date().toISOString().split('T')[0];
    const visibleGroups = Object.entries(groups).filter(([, ts]) => ts.length > 0);

    // 單一 table，用分隔列區分校區 → 欄寬全程對齊，不會亂跑
    return (
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="text-left py-2.5 px-4 font-medium">任務</th>
              <th className="text-left py-2.5 px-4 font-medium w-20">類型</th>
              <th className="text-left py-2.5 px-4 font-medium w-24">負責人</th>
              <th className="text-left py-2.5 px-4 font-medium w-24">截止日</th>
              <th className="text-left py-2.5 px-4 font-medium w-16">量能</th>
              <th className="text-left py-2.5 px-4 font-medium w-20">狀態</th>
              <th className="py-2.5 px-4 w-20" />
            </tr>
          </thead>
          <tbody>
            {visibleGroups.map(([campusName, campusTasks]) => {
              const overdueCount = campusTasks.filter(
                (t) => t.due_date && t.status !== 'completed' && t.due_date < today
              ).length;
              return (
                <>
                  <tr key={`group-${campusName}`} className="bg-muted/30 border-b border-t">
                    <td colSpan={7} className="py-2 px-4">
                      <span className="font-medium text-xs text-muted-foreground uppercase tracking-wide">
                        {campusName}
                      </span>
                      <span className="ml-2 text-xs text-muted-foreground">{campusTasks.length} 筆</span>
                      {overdueCount > 0 && (
                        <span className="ml-2 text-xs text-red-500 font-medium">逾期 {overdueCount}</span>
                      )}
                    </td>
                  </tr>
                  {campusTasks.map((t) => renderTaskRow(t, true))}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div>
      {/* 工具列 */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex gap-2 flex-1">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as TaskType | '')}
            className="text-sm border rounded px-2 py-1.5 bg-background"
          >
            {TASK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as TaskStatus | '')}
            className="text-sm border rounded px-2 py-1.5 bg-background"
          >
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select
            value={filterCampus}
            onChange={(e) => setFilterCampus(e.target.value)}
            className="text-sm border rounded px-2 py-1.5 bg-background"
          >
            <option value="">全部校區</option>
            {CAMPUSES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setGroupByCampus((v) => !v)}
        >
          {groupByCampus ? '清單視圖' : '校區分組'}
        </Button>
        <Button size="sm" onClick={() => setShowDialog(true)}>＋ 新增任務</Button>
        <Link href="/admin/routines">
          <Button variant="ghost" size="sm">管理例行任務</Button>
        </Link>
      </div>

      {/* 任務清單 */}
      {groupByCampus ? (
        renderCampusGroup()
      ) : (
        <TaskTable tasks={filtered} renderRow={renderTaskRow} />
      )}

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">沒有符合條件的任務</p>
      )}

      {showDialog && (
        <TaskDialog
          teachers={teachers}
          onClose={() => setShowDialog(false)}
        />
      )}
    </div>
  );
}

function TaskTable({
  tasks,
  renderRow,
}: {
  tasks: (AdminTask & { assigned_teacher?: { id: string; name: string } | null })[];
  renderRow: (t: AdminTask & { assigned_teacher?: { id: string; name: string } | null }) => React.ReactNode;
}) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th className="text-left py-2.5 px-4 font-medium">任務</th>
            <th className="text-left py-2.5 px-4 font-medium w-20">類型</th>
            <th className="text-left py-2.5 px-4 font-medium w-24">負責人</th>
            <th className="text-left py-2.5 px-4 font-medium w-24">校區</th>
            <th className="text-left py-2.5 px-4 font-medium w-24">截止日</th>
            <th className="text-left py-2.5 px-4 font-medium w-16">量能</th>
            <th className="text-left py-2.5 px-4 font-medium w-20">狀態</th>
            <th className="py-2.5 px-4 w-20" />
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => renderRow(t))}
        </tbody>
      </table>
    </div>
  );
}
