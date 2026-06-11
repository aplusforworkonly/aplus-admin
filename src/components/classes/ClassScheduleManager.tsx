'use client';
import { useOptimistic, useTransition, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createClassSchedule, deleteClassSchedule } from '@/actions/schedules';
import type { ClassSchedule } from '@/lib/supabase/types';

const DAYS = ['日', '一', '二', '三', '四', '五', '六'];

function fmtTime(t: string) { return t.slice(0, 5); }
function fmtDate(d: string | null) { return d ? d : '—'; }

export function ClassScheduleManager({
  classId,
  schedules,
  onMutate,
}: {
  classId: string;
  schedules: ClassSchedule[];
  onMutate?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    day_of_week: '1',
    start_time: '',
    end_time: '',
    valid_from: '',
    valid_until: '',
  });

  const [optimisticSchedules, dispatchOptimistic] = useOptimistic(
    schedules,
    (
      state: ClassSchedule[],
      action: { type: 'add'; item: ClassSchedule } | { type: 'delete'; id: string }
    ) =>
      action.type === 'add'
        ? [...state, action.item]
        : state.filter((s) => s.id !== action.id)
  );

  function handleDelete(scheduleId: string) {
    startTransition(async () => {
      dispatchOptimistic({ type: 'delete', id: scheduleId });
      await deleteClassSchedule(scheduleId, classId);
      onMutate?.();
    });
  }

  function handleAdd() {
    setError('');
    const { day_of_week, start_time, end_time, valid_from, valid_until } = form;

    if (!start_time || !end_time) { setError('請填寫開始與結束時間'); return; }

    const startFull = start_time + ':00';
    const endFull = end_time + ':00';
    if (endFull <= startFull) { setError('結束時間必須晚於開始時間'); return; }

    const vf = valid_from || null;
    const vu = valid_until || null;
    if (vf && vu && vu < vf) { setError('有效迄日必須晚於有效起日'); return; }

    const tempId = crypto.randomUUID();
    const optimisticItem: ClassSchedule = {
      id: tempId,
      class_id: classId,
      day_of_week: Number(day_of_week),
      start_time: startFull,
      end_time: endFull,
      valid_from: vf,
      valid_until: vu,
      created_at: new Date().toISOString(),
    };

    startTransition(async () => {
      dispatchOptimistic({ type: 'add', item: optimisticItem });
      await createClassSchedule(classId, {
        day_of_week: Number(day_of_week),
        start_time,
        end_time,
        valid_from: vf,
        valid_until: vu,
      });
      setForm({ day_of_week: '1', start_time: '', end_time: '', valid_from: '', valid_until: '' });
      onMutate?.();
    });
  }

  return (
    <div className="space-y-4" style={{ opacity: isPending ? 0.7 : 1, transition: 'opacity 0.15s' }}>
      {optimisticSchedules.length === 0 ? (
        <p className="text-sm text-muted-foreground">尚未設定任何時段</p>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-2 font-medium">星期</th>
                <th className="text-left px-3 py-2 font-medium">開始</th>
                <th className="text-left px-3 py-2 font-medium">結束</th>
                <th className="text-left px-3 py-2 font-medium">有效起</th>
                <th className="text-left px-3 py-2 font-medium">有效迄</th>
                <th className="w-16"></th>
              </tr>
            </thead>
            <tbody>
              {optimisticSchedules
                .slice()
                .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time))
                .map((s) => (
                  <tr key={s.id} className="border-t hover:bg-muted/20">
                    <td className="px-3 py-2">週{DAYS[s.day_of_week]}</td>
                    <td className="px-3 py-2 tabular-nums">{fmtTime(s.start_time)}</td>
                    <td className="px-3 py-2 tabular-nums">{fmtTime(s.end_time)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{fmtDate(s.valid_from)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{fmtDate(s.valid_until)}</td>
                    <td className="px-3 py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive h-7 px-2"
                        onClick={() => handleDelete(s.id)}
                        disabled={isPending}
                      >
                        刪除
                      </Button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 新增表單 */}
      <div className="flex flex-wrap items-end gap-2 pt-1">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">星期</label>
          <Select
            value={form.day_of_week}
            onValueChange={(v) => v && setForm((f) => ({ ...f, day_of_week: v }))}
            disabled={isPending}
          >
            <SelectTrigger className="w-24 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <SelectItem key={d} value={String(d)}>
                  週{DAYS[d]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">開始時間</label>
          <input
            type="time"
            value={form.start_time}
            onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
            disabled={isPending}
            className="h-8 px-2 text-sm border rounded-md bg-background disabled:opacity-50"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">結束時間</label>
          <input
            type="time"
            value={form.end_time}
            onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
            disabled={isPending}
            className="h-8 px-2 text-sm border rounded-md bg-background disabled:opacity-50"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">有效起（選填）</label>
          <input
            type="date"
            value={form.valid_from}
            onChange={(e) => setForm((f) => ({ ...f, valid_from: e.target.value }))}
            disabled={isPending}
            className="h-8 px-2 text-sm border rounded-md bg-background disabled:opacity-50"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">有效迄（選填）</label>
          <input
            type="date"
            value={form.valid_until}
            onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))}
            disabled={isPending}
            className="h-8 px-2 text-sm border rounded-md bg-background disabled:opacity-50"
          />
        </div>

        <Button size="sm" onClick={handleAdd} disabled={isPending} className="h-8 self-end">
          新增時段
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
