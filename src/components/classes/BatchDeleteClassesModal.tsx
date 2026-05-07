'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { batchDeleteClasses } from '@/actions/delete-classes';

const CATEGORY_LABELS: Record<string, string> = {
  homeroom: '教學班',
  english_core: '英語核心',
  elective: '選修',
};

export type ClassItem = {
  id: string;
  name: string;
  campus: string;
  category: string;
  academic_year: string | null;
  term: string | null;
  student_count: number;
};

export default function BatchDeleteClassesModal({
  classes,
  onClose,
}: {
  classes: ClassItem[];
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmed, setConfirmed] = useState(false);
  const [deleted, setDeleted] = useState(0);
  const [deleteError, setDeleteError] = useState('');
  const [pending, startTransition] = useTransition();

  const allChecked = classes.length > 0 && classes.every((c) => selected.has(c.id));

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(classes.map((c) => c.id)));
  }

  function handleDelete() {
    startTransition(async () => {
      const ids = [...selected];
      const result = await batchDeleteClasses(ids);
      if (result.error) {
        setDeleteError(result.error);
        return;
      }
      setDeleted(result.deleted);
      setConfirmed(false);
    });
  }

  const selectedList = classes.filter((c) => selected.has(c.id));
  const totalStudents = selectedList.reduce((sum, c) => sum + c.student_count, 0);

  // Done state
  if (deleted > 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
        <div className="bg-background rounded-lg shadow-lg w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
          <p className="text-sm">已成功刪除 <span className="font-semibold">{deleted}</span> 個班級。</p>
          <div className="flex justify-end">
            <Button onClick={onClose}>關閉</Button>
          </div>
        </div>
      </div>
    );
  }

  // Confirm step
  if (confirmed) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setConfirmed(false)}>
        <div className="bg-background rounded-lg shadow-lg w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-base font-semibold text-destructive">確認刪除？</h2>
          <p className="text-sm text-muted-foreground">
            即將刪除 <span className="font-medium text-foreground">{selectedList.length}</span> 個班級
            {totalStudents > 0 && <>，並移除 <span className="font-medium text-foreground">{totalStudents}</span> 筆學生分班記錄</>}。
            此操作無法復原。
          </p>
          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmed(false)}>返回</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={pending}>
              {pending ? '刪除中...' : '確認刪除'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Selection step
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-background rounded-lg shadow-lg w-full max-w-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">批次刪除班級</h2>

        {classes.length === 0 ? (
          <p className="text-sm text-muted-foreground">目前沒有班級可刪除。</p>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2 w-8">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={toggleAll}
                      className="cursor-pointer"
                    />
                  </th>
                  <th className="text-left px-4 py-2 font-medium">班級名稱</th>
                  <th className="text-left px-4 py-2 font-medium">校區</th>
                  <th className="text-left px-4 py-2 font-medium">類別</th>
                  <th className="text-left px-4 py-2 font-medium">學年 / 學期</th>
                  <th className="text-right px-4 py-2 font-medium">學生數</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((c) => (
                  <tr
                    key={c.id}
                    className={`border-t cursor-pointer hover:bg-muted/30 transition-opacity ${!selected.has(c.id) ? 'opacity-50' : ''}`}
                    onClick={() => toggleOne(c.id)}
                  >
                    <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => toggleOne(c.id)}
                        className="cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-2 font-medium">{c.name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{c.campus}</td>
                    <td className="px-4 py-2 text-muted-foreground">{CATEGORY_LABELS[c.category] ?? c.category}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {[c.academic_year, c.term].filter(Boolean).join(' ') || '—'}
                    </td>
                    <td className="px-4 py-2 text-right">{c.student_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-muted-foreground">
            {selected.size > 0
              ? `已選取 ${selected.size} 個班級`
              : '請勾選要刪除的班級'}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>取消</Button>
            <Button
              variant="destructive"
              disabled={selected.size === 0}
              onClick={() => setConfirmed(true)}
            >
              刪除（{selected.size}）
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
