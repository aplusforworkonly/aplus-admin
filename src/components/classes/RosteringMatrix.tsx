'use client';
import { useState, useMemo, useEffect, useTransition, useRef } from 'react';
import { saveRosterAssignments } from '@/actions/classes';
import { Button } from '@/components/ui/button';

export type StudentRow = {
  id: string;
  name: string;
  englishName: string | null;
  grade: string;
  mainTutorName: string | null;
  assignedClassId: string | null;
  isLocked: boolean;
};

export type ClassOption = {
  id: string;
  name: string;
  capacity: number | null;
  enrolledCount: number;
};

export default function RosteringMatrix({
  courseId,
  courseName,
  initialRows,
  classes,
}: {
  courseId: string;
  courseName: string;
  initialRows: StudentRow[];
  classes: ClassOption[];
}) {
  const [assignments, setAssignments] = useState<Record<string, string | null>>(
    () => Object.fromEntries(initialRows.map((r) => [r.id, r.assignedClassId]))
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchClassId, setBatchClassId] = useState<string>('');
  const [drag, setDrag] = useState<{ value: string | null; startIdx: number } | null>(null);
  const [dragEndIdx, setDragEndIdx] = useState<number>(-1);
  const [saving, startSave] = useTransition();
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const dragInProgress = useRef(false);

  // Window mouseup listener for drag-to-fill
  useEffect(() => {
    if (!drag) return;
    const handleUp = () => {
      if (dragEndIdx >= 0) {
        const lo = Math.min(drag.startIdx, dragEndIdx);
        const hi = Math.max(drag.startIdx, dragEndIdx);
        setAssignments((prev) => {
          const next = { ...prev };
          for (let i = lo; i <= hi; i++) {
            const row = initialRows[i];
            if (!row.isLocked) next[row.id] = drag.value;
          }
          return next;
        });
      }
      setDrag(null);
      setDragEndIdx(-1);
      dragInProgress.current = false;
    };
    window.addEventListener('mouseup', handleUp);
    return () => window.removeEventListener('mouseup', handleUp);
  }, [drag, dragEndIdx, initialRows]);

  const displayCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of classes) {
      const baseCount =
        c.enrolledCount - initialRows.filter((r) => r.assignedClassId === c.id).length;
      const currentAssignCount = Object.values(assignments).filter((id) => id === c.id).length;
      map[c.id] = baseCount + currentAssignCount;
    }
    return map;
  }, [assignments, classes, initialRows]);

  const allSelected = selected.size === initialRows.length && initialRows.length > 0;
  const someSelected = selected.size > 0;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(initialRows.map((r) => r.id)));
    }
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function applyBatch() {
    if (!batchClassId && batchClassId !== '') return;
    setAssignments((prev) => {
      const next = { ...prev };
      for (const id of selected) {
        next[id] = batchClassId || null;
      }
      return next;
    });
    setSelected(new Set());
    setBatchClassId('');
  }

  function handleSave() {
    setSaveError('');
    setSaveSuccess(false);
    startSave(async () => {
      try {
        await saveRosterAssignments(
          courseId,
          initialRows.map((r) => ({ studentId: r.id, classId: assignments[r.id] ?? null }))
        );
        setSaveSuccess(true);
      } catch (err: unknown) {
        setSaveError(err instanceof Error ? err.message : '儲存失敗');
      }
    });
  }

  const isDirty = initialRows.some((r) => assignments[r.id] !== r.assignedClassId);
  const changedCount = initialRows.filter((r) => assignments[r.id] !== r.assignedClassId).length;

  const dragRange =
    drag && dragEndIdx >= 0
      ? [Math.min(drag.startIdx, dragEndIdx), Math.max(drag.startIdx, dragEndIdx)]
      : null;

  return (
    <div className="bg-background rounded-xl border shadow-sm space-y-4 p-6">
      {/* Class capacity chips */}
      <div className="flex flex-wrap gap-2">
        {classes.map((c) => {
          const count = displayCounts[c.id] ?? 0;
          const isFull = c.capacity !== null && count >= c.capacity;
          return (
            <span
              key={c.id}
              className={`text-xs px-2.5 py-1 rounded-full border ${
                isFull
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-muted text-muted-foreground border-muted-foreground/20'
              }`}
            >
              {c.name}　{count}{c.capacity ? `/${c.capacity}` : ''}人
            </span>
          );
        })}
      </div>

      {/* Batch toolbar */}
      {someSelected && (
        <div className="flex items-center gap-3 bg-muted/60 border rounded-lg px-4 py-2.5">
          <span className="text-sm font-medium">已選 {selected.size} 人</span>
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            value={batchClassId}
            onChange={(e) => setBatchClassId(e.target.value)}
          >
            <option value="">— 選擇班級 —</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
            <option value="">（清除分班）</option>
          </select>
          <Button size="sm" variant="default" onClick={applyBatch}>
            套用
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            取消選取
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="w-10 py-2 px-2 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected && !allSelected;
                  }}
                  onChange={toggleAll}
                  className="rounded"
                />
              </th>
              <th className="py-2 px-2 text-left font-medium w-20">姓名</th>
              <th className="py-2 px-2 text-left font-medium w-16">年級</th>
              <th className="py-2 px-2 text-left font-medium w-28">總導師</th>
              <th className="py-2 px-2 text-left font-medium">分配班級</th>
            </tr>
          </thead>
          <tbody>
            {initialRows.map((row, i) => {
              const inDragRange = dragRange !== null && i >= dragRange[0] && i <= dragRange[1];
              return (
                <tr
                  key={row.id}
                  className={`border-b transition-colors ${
                    inDragRange ? 'bg-blue-50' : selected.has(row.id) ? 'bg-muted/40' : 'hover:bg-muted/20'
                  }`}
                  onMouseEnter={() => {
                    if (dragInProgress.current) setDragEndIdx(i);
                  }}
                >
                  <td className="py-2 px-2">
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggleRow(row.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="py-2 px-2">
                    <p className="font-medium">{row.name}</p>
                    {row.englishName && <p className="text-xs text-muted-foreground">{row.englishName}</p>}
                  </td>
                  <td className="py-2 px-2 text-muted-foreground">{row.grade}</td>
                  <td className="py-2 px-2 text-muted-foreground">
                    {row.mainTutorName ?? (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted border text-muted-foreground">新生</span>
                    )}
                  </td>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-1 relative">
                      <select
                        className="h-8 rounded-md border border-input bg-background px-2 text-sm flex-1"
                        value={assignments[row.id] ?? ''}
                        disabled={row.isLocked}
                        onChange={(e) => {
                          const val = e.target.value || null;
                          setAssignments((prev) => ({ ...prev, [row.id]: val }));
                        }}
                      >
                        <option value="">— 未分班 —</option>
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      {!row.isLocked && (
                        <div
                          className="w-3 h-3 rounded-sm border-2 border-primary bg-background cursor-crosshair shrink-0 hover:bg-primary/20"
                          title="拖曳填充"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            dragInProgress.current = true;
                            setDrag({ value: assignments[row.id] ?? null, startIdx: i });
                            setDragEndIdx(i);
                          }}
                        />
                      )}
                      {row.isLocked && (
                        <span className="text-xs text-amber-600 shrink-0">營隊鎖定</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Save area */}
      {saveError && <p className="text-sm text-destructive">{saveError}</p>}
      {saveSuccess && (
        <p className="text-sm text-green-700">✓ 分班結果已儲存。</p>
      )}
      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-muted-foreground">
          共 {initialRows.length} 位學生　{changedCount > 0 ? `${changedCount} 筆待儲存` : '無變更'}
        </p>
        <Button
          disabled={!isDirty || saving}
          onClick={handleSave}
        >
          {saving ? '儲存中...' : `儲存分班結果${changedCount > 0 ? `（${changedCount} 筆）` : ''}`}
        </Button>
      </div>
    </div>
  );
}
