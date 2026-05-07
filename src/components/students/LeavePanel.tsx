'use client';
import { useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { addLeave, deleteLeave } from '@/actions/leaves';
import type { StudentLeave } from '@/lib/supabase/types';

export default function LeavePanel({
  studentId,
  leaves,
}: {
  studentId: string;
  leaves: StudentLeave[];
}) {
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!date) return;
    setError('');
    startTransition(async () => {
      try {
        await addLeave(studentId, date, note);
        setDate('');
        setNote('');
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : '新增失敗');
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(() => deleteLeave(id, studentId));
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleAdd} className="flex gap-2 items-end">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">日期</p>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-36"
            required
          />
        </div>
        <div className="space-y-1 flex-1">
          <p className="text-xs text-muted-foreground">備註（選填）</p>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="例：身體不適"
          />
        </div>
        <Button type="submit" size="sm" disabled={pending}>新增</Button>
      </form>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {leaves.length === 0 ? (
        <p className="text-sm text-muted-foreground">尚無請假紀錄</p>
      ) : (
        <ul className="space-y-1">
          {leaves.map((l) => (
            <li key={l.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
              <span className="font-mono">{l.leave_date}</span>
              {l.note && <span className="text-muted-foreground text-xs ml-3 flex-1">{l.note}</span>}
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => handleDelete(l.id, )}
                className="text-destructive hover:text-destructive h-6 px-2"
              >
                刪除
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
