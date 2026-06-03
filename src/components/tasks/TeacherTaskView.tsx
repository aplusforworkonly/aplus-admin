'use client';
import { useState } from 'react';
import { TaskCard } from './TaskCard';
import type { AdminTask } from '@/lib/supabase/types';

const SECTIONS = [
  { key: 'todayOverdue', label: '📅 今日 / 逾期', emptyText: '今天沒有待辦，繼續保持！' },
  { key: 'upcoming',    label: '📆 近期 7 天',  emptyText: '近期無待辦任務' },
  { key: 'inbox',       label: '🗂 收件匣',     emptyText: '收件匣空了，太棒了！' },
  { key: 'projects',    label: '📁 專案',       emptyText: '目前沒有進行中的專案' },
  { key: 'routines',    label: '🔁 例行任務',   emptyText: '今日沒有例行任務' },
] as const;

type SectionKey = typeof SECTIONS[number]['key'];

function categorizeTasks(tasks: AdminTask[]) {
  const todayStr = new Date().toISOString().split('T')[0];
  const in7DaysStr = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const result: Record<SectionKey, AdminTask[]> = {
    todayOverdue: [],
    upcoming: [],
    inbox: [],
    projects: [],
    routines: [],
  };

  // 嚴格互斥分類：每個任務只進一個區域（依優先順序判斷）
  for (const task of tasks) {
    if (task.due_date && task.due_date <= todayStr) {
      result.todayOverdue.push(task);
    } else if (task.due_date && task.due_date > todayStr && task.due_date <= in7DaysStr) {
      result.upcoming.push(task);
    } else if (!task.due_date && task.task_type === 'adhoc') {
      result.inbox.push(task);
    } else if (task.task_type === 'project') {
      result.projects.push(task);
    } else if (task.task_type === 'routine') {
      result.routines.push(task);
    }
    // 不符合任何分類的任務（如無截止日的非突發任務）暫歸收件匣
    else {
      result.inbox.push(task);
    }
  }
  return result;
}

export function TeacherTaskView({ tasks }: { tasks: AdminTask[] }) {
  const [activeSection, setActiveSection] = useState<SectionKey>('todayOverdue');
  const categorized = categorizeTasks(tasks);

  const totalPending = tasks.length;

  return (
    <div className="flex h-[calc(100vh-9rem)] overflow-hidden">
      {/* 左側導覽 */}
      <aside className="w-48 shrink-0 border-r bg-muted/20 p-3 space-y-1 overflow-y-auto">
        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider px-2 pb-2">
          我的任務 · {totalPending} 筆
        </p>
        {SECTIONS.map((s) => {
          const count = categorized[s.key].length;
          return (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
                activeSection === s.key
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'hover:bg-muted text-foreground'
              }`}
            >
              <span>{s.label}</span>
              {count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium leading-none ${
                  activeSection === s.key
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : s.key === 'todayOverdue'
                      ? 'bg-red-100 text-red-600'
                      : 'bg-slate-200 text-slate-600'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </aside>

      {/* 右側任務清單 */}
      <main className="flex-1 overflow-y-auto p-5">
        {(() => {
          const section = SECTIONS.find((s) => s.key === activeSection)!;
          const sectionTasks = categorized[activeSection];
          return (
            <>
              <h2 className="text-base font-semibold mb-4">{section.label}</h2>
              {sectionTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">{section.emptyText}</p>
              ) : (
                <div className="space-y-2">
                  {sectionTasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
              )}
            </>
          );
        })()}
      </main>
    </div>
  );
}
