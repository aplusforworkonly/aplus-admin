'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RoutingRuleForm } from './RoutingRuleForm';
import { toggleRoutingRuleActive, deleteRoutingRule } from '@/actions/task-routing-rules';
import type { TaskSource } from '@/lib/supabase/types';

const GRADE_LABELS: Record<number, string> = {
  0: '大班升小一', 1: '小一', 2: '小二', 3: '小三',
  4: '小四', 5: '小五', 6: '小六',
};
const SOURCE_LABELS: Partial<Record<TaskSource, string>> = {
  leave_request: '請假申請',
  student_request: '課程異動',
  student_review: '資料審核',
};

function gradeRange(from: number | null, to: number | null): string {
  if (from == null && to == null) return '全年級';
  if (from != null && to == null) return `${GRADE_LABELS[from] ?? from} 以上`;
  if (from == null && to != null) return `${GRADE_LABELS[to] ?? to} 以下`;
  if (from === to) return GRADE_LABELS[from!] ?? String(from);
  return `${GRADE_LABELS[from!] ?? from} ~ ${GRADE_LABELS[to!] ?? to}`;
}

interface Rule {
  id: string;
  campus: string | null;
  task_source: TaskSource | null;
  grade_from: number | null;
  grade_to: number | null;
  assigned_to: string;
  priority: number;
  is_active: boolean;
  assigned_teacher?: { id: string; name: string; campus: string | null } | null;
}

interface Props {
  rules: Rule[];
  teachers: { id: string; name: string; campus: string | null }[];
}

export function RoutingRuleListClient({ rules, teachers }: Props) {
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [editRule, setEditRule] = useState<Rule | undefined>();

  function handleDelete(id: string) {
    if (!confirm('確認刪除此指派規則？')) return;
    startTransition(() => deleteRoutingRule(id));
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={() => { setEditRule(undefined); setShowForm(true); }}>
          ＋ 新增規則
        </Button>
      </div>

      {rules.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">尚未設定任何指派規則</p>
      )}

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="text-left py-2.5 px-4 font-medium">校區</th>
              <th className="text-left py-2.5 px-4 font-medium">任務類型</th>
              <th className="text-left py-2.5 px-4 font-medium">年級範圍</th>
              <th className="text-left py-2.5 px-4 font-medium">指派給</th>
              <th className="text-left py-2.5 px-4 font-medium">優先級</th>
              <th className="text-left py-2.5 px-4 font-medium">狀態</th>
              <th className="py-2.5 px-4" />
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id} className="border-b last:border-0 hover:bg-accent/30 transition-colors">
                <td className="py-3 px-4">{rule.campus ?? <span className="text-muted-foreground">全部校區</span>}</td>
                <td className="py-3 px-4">
                  {rule.task_source
                    ? SOURCE_LABELS[rule.task_source] ?? rule.task_source
                    : <span className="text-muted-foreground">全部類型</span>}
                </td>
                <td className="py-3 px-4">{gradeRange(rule.grade_from, rule.grade_to)}</td>
                <td className="py-3 px-4 font-medium">
                  {rule.assigned_teacher?.name ?? '—'}
                </td>
                <td className="py-3 px-4">
                  <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                    {rule.priority}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <Badge
                    variant="outline"
                    className={rule.is_active ? 'text-green-700 border-green-300 bg-green-50' : 'text-slate-400'}
                  >
                    {rule.is_active ? '啟用' : '停用'}
                  </Badge>
                </td>
                <td className="py-3 px-4">
                  <div className="flex gap-1 justify-end">
                    <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={pending}
                      onClick={() => startTransition(() => toggleRoutingRuleActive(rule.id, !rule.is_active))}>
                      {rule.is_active ? '停用' : '啟用'}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={pending}
                      onClick={() => { setEditRule(rule); setShowForm(true); }}>
                      編輯
                    </Button>
                    <Button size="sm" variant="ghost"
                      className="h-7 text-xs text-destructive hover:text-destructive"
                      disabled={pending} onClick={() => handleDelete(rule.id)}>
                      刪除
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <RoutingRuleForm
          teachers={teachers}
          editRule={editRule as any}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
