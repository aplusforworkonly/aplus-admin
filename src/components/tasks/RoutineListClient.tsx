'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RoutineForm } from './RoutineForm';
import { toggleRoutineActive, deleteRoutineDefinition } from '@/actions/routine-definitions';
import type { RoutineDefinition } from '@/lib/supabase/types';

const WEEKDAYS = ['', '一', '二', '三', '四', '五', '六', '日'];

function freqLabel(def: RoutineDefinition): string {
  if (def.frequency_type === 'daily') return '每天';
  if (def.frequency_type === 'weekly') {
    const d = def.frequency_value != null ? WEEKDAYS[def.frequency_value] : '?';
    return `每週${d}`;
  }
  if (def.frequency_type === 'monthly') {
    return `每月 ${def.frequency_value ?? '?'} 號`;
  }
  return '—';
}

interface DefWithTeacher extends RoutineDefinition {
  assigned_teacher?: { id: string; name: string } | null;
}

interface Props {
  defs: DefWithTeacher[];
  teachers: { id: string; name: string }[];
}

export function RoutineListClient({ defs, teachers }: Props) {
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [editDef, setEditDef] = useState<RoutineDefinition | undefined>();

  function handleDelete(id: string) {
    if (!confirm('確認刪除此例行任務範本？刪除後已產生的任務不受影響。')) return;
    startTransition(() => deleteRoutineDefinition(id));
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={() => { setEditDef(undefined); setShowForm(true); }}>
          ＋ 新增範本
        </Button>
      </div>

      {defs.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">尚未建立任何例行任務範本</p>
      )}

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="text-left py-2.5 px-4 font-medium">任務名稱</th>
              <th className="text-left py-2.5 px-4 font-medium">頻率</th>
              <th className="text-left py-2.5 px-4 font-medium">提前</th>
              <th className="text-left py-2.5 px-4 font-medium">負責人</th>
              <th className="text-left py-2.5 px-4 font-medium">校區</th>
              <th className="text-left py-2.5 px-4 font-medium">量能</th>
              <th className="text-left py-2.5 px-4 font-medium">狀態</th>
              <th className="py-2.5 px-4" />
            </tr>
          </thead>
          <tbody>
            {defs.map((def) => (
              <tr key={def.id} className="border-b last:border-0 hover:bg-accent/30 transition-colors">
                <td className="py-3 px-4 font-medium">
                  {def.title}
                  {def.description && (
                    <p className="text-xs text-muted-foreground font-normal">{def.description}</p>
                  )}
                </td>
                <td className="py-3 px-4">{freqLabel(def)}</td>
                <td className="py-3 px-4 text-muted-foreground">
                  {def.advance_days === 0 ? '當天' : `${def.advance_days}天前`}
                </td>
                <td className="py-3 px-4 text-muted-foreground">
                  {def.assigned_teacher?.name ?? '—'}
                </td>
                <td className="py-3 px-4 text-muted-foreground">
                  {def.campus?.join('、') || '—'}
                </td>
                <td className="py-3 px-4">
                  {def.size && (
                    <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                      {def.size}
                    </span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <Badge
                    variant="outline"
                    className={def.is_active ? 'text-green-700 border-green-300 bg-green-50' : 'text-slate-400'}
                  >
                    {def.is_active ? '啟用' : '停用'}
                  </Badge>
                </td>
                <td className="py-3 px-4">
                  <div className="flex gap-1 justify-end">
                    <Button
                      size="sm" variant="ghost" className="h-7 text-xs"
                      disabled={pending}
                      onClick={() => startTransition(() => toggleRoutineActive(def.id, !def.is_active))}
                    >
                      {def.is_active ? '停用' : '啟用'}
                    </Button>
                    <Button
                      size="sm" variant="ghost" className="h-7 text-xs"
                      disabled={pending}
                      onClick={() => { setEditDef(def); setShowForm(true); }}
                    >
                      編輯
                    </Button>
                    <Button
                      size="sm" variant="ghost"
                      className="h-7 text-xs text-destructive hover:text-destructive"
                      disabled={pending}
                      onClick={() => handleDelete(def.id)}
                    >
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
        <RoutineForm
          teachers={teachers}
          editDef={editDef}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
