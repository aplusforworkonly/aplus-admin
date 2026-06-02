'use client';
import { useState, useMemo, useEffect, useTransition, useRef } from 'react';
import { saveRosterAssignments } from '@/actions/classes';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export type StudentRow = {
  id: string;
  name: string;
  englishName: string | null;
  grade: string;
  campus: string | null;
  mainTutorName: string | null;
  assignedClassId: string | null;
  isLocked: boolean;
};

export type ClassOption = {
  id: string;
  name: string;
  capacity: number | null;
  enrolledCount: number;
  teacherId: string | null;
  teacherName: string | null;
};

export default function RosteringMatrix({
  courseIds,
  courseName,
  initialRows,
  classes,
}: {
  courseIds: string[];
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
  const [gradeFilter, setGradeFilter] = useState('');
  const [campusFilter, setCampusFilter] = useState('');
  const [tutorFilter, setTutorFilter] = useState('');
  const [showOnlyPending, setShowOnlyPending] = useState(false);
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

  const uniqueGrades = useMemo(
    () => [...new Set(initialRows.map((r) => r.grade))].sort(),
    [initialRows]
  );
  const uniqueCampuses = useMemo(
    () => [...new Set(initialRows.map((r) => r.campus).filter(Boolean) as string[])].sort(),
    [initialRows]
  );
  const uniqueTutors = useMemo(
    () => [...new Set(initialRows.map((r) => r.mainTutorName).filter(Boolean) as string[])].sort(),
    [initialRows]
  );

  const filteredRows = useMemo(
    () =>
      initialRows.map((row, i) => ({ row, i })).filter(({ row }) => {
        if (gradeFilter && row.grade !== gradeFilter) return false;
        if (campusFilter && row.campus !== campusFilter) return false;
        if (tutorFilter && row.mainTutorName !== tutorFilter) return false;
        return true;
      }),
    [initialRows, gradeFilter, campusFilter, tutorFilter]
  );

  const rosterGroups = useMemo(() => {
    const byClass = classes.map((c) => {
      const students = initialRows.filter((r) => assignments[r.id] === c.id);
      return { ...c, students, draftCount: students.length };
    });
    const unassigned = initialRows.filter((r) => !assignments[r.id]);
    return { byClass, unassigned };
  }, [classes, initialRows, assignments]);

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

  const visibleIds = filteredRows.map(({ row }) => row.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  function toggleAll() {
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelected((prev) => new Set([...prev, ...visibleIds]));
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
          courseIds,
          initialRows.map((r) => ({ studentId: r.id, classId: assignments[r.id] ?? null }))
        );
        setSaveSuccess(true);
      } catch (err: unknown) {
        setSaveError(err instanceof Error ? err.message : '儲存失敗');
      }
    });
  }

  // 待分班數：用 assignments 草稿狀態即時計算，指派後立刻反映
  const pendingRows = useMemo(
    () => filteredRows.filter(({ row }) => !assignments[row.id]),
    [filteredRows, assignments],
  );
  const pendingCount = pendingRows.length;

  // 顯示列：若開啟「只看未分班」則進一步過濾
  const displayRows = showOnlyPending ? pendingRows : filteredRows;

  const isDirty = initialRows.some((r) => assignments[r.id] !== r.assignedClassId);
  const changedCount = initialRows.filter((r) => assignments[r.id] !== r.assignedClassId).length;

  const dragRange =
    drag && dragEndIdx >= 0
      ? [Math.min(drag.startIdx, dragEndIdx), Math.max(drag.startIdx, dragEndIdx)]
      : null;

  return (
    <div className="bg-background rounded-xl border shadow-sm p-6">
      <Tabs defaultValue="matrix">
        <TabsList className="mb-4">
          <TabsTrigger value="matrix">分班矩陣</TabsTrigger>
          <TabsTrigger value="roster">班級名單</TabsTrigger>
        </TabsList>

        {/* ── 分班矩陣 Tab ── */}
        <TabsContent value="matrix" className="space-y-4 mt-0">
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

          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
            >
              <option value="">全部年級</option>
              {uniqueGrades.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              value={campusFilter}
              onChange={(e) => setCampusFilter(e.target.value)}
            >
              <option value="">全部校區</option>
              {uniqueCampuses.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-sm min-w-36"
              value={tutorFilter}
              onChange={(e) => setTutorFilter(e.target.value)}
            >
              <option value="">全部總導師</option>
              {uniqueTutors.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {(gradeFilter || campusFilter || tutorFilter) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => { setGradeFilter(''); setCampusFilter(''); setTutorFilter(''); }}
                className="text-xs text-muted-foreground h-8 px-2"
              >
                清除篩選
              </Button>
            )}
            {pendingCount > 0 && (
              <Button
                size="sm"
                variant={showOnlyPending ? 'default' : 'outline'}
                onClick={() => setShowOnlyPending((v) => !v)}
                className={showOnlyPending ? '' : 'text-amber-600 border-amber-300 hover:bg-amber-50'}
              >
                待分班 {pendingCount} 人
              </Button>
            )}
            {(gradeFilter || campusFilter || tutorFilter || showOnlyPending) && (
              <span className="text-xs text-muted-foreground ml-auto">
                顯示 {displayRows.length} / {initialRows.length} 位
              </span>
            )}
          </div>

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
                  <th className="py-2 px-2 text-left font-medium w-20">校區</th>
                  <th className="py-2 px-2 text-left font-medium w-28">總導師</th>
                  <th className="py-2 px-2 text-left font-medium">分配班級</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map(({ row, i }) => {
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
                      <td className="py-2 px-2 text-muted-foreground">{row.campus ?? '—'}</td>
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
        </TabsContent>

        {/* ── 班級名單 Tab ── */}
        <TabsContent value="roster" className="mt-0 space-y-4">
          {rosterGroups.byClass.map((c) => {
            const isOver = c.capacity !== null && c.draftCount > c.capacity;
            return (
              <div key={c.id} className="rounded-xl border shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b">
                  <div className="font-semibold text-sm">
                    {c.name}
                    {c.teacherName && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">· {c.teacherName}</span>
                    )}
                  </div>
                  <span className={`text-sm tabular-nums ${isOver ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                    {c.draftCount}{c.capacity != null ? ` / ${c.capacity}` : ''} 人
                  </span>
                </div>
                {c.students.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-muted-foreground">尚無學生分配至此班</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th className="py-2 px-4 text-left font-medium">姓名</th>
                        <th className="py-2 px-4 text-left font-medium w-16">年級</th>
                        <th className="py-2 px-4 text-left font-medium w-24">校區</th>
                        <th className="py-2 px-4 text-left font-medium">總導師</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.students.map((row) => (
                        <tr key={row.id} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="py-2 px-4">
                            <p className="font-medium">{row.name}</p>
                            {row.englishName && <p className="text-xs text-muted-foreground">{row.englishName}</p>}
                          </td>
                          <td className="py-2 px-4 text-muted-foreground">{row.grade}</td>
                          <td className="py-2 px-4 text-muted-foreground">{row.campus ?? '—'}</td>
                          <td className="py-2 px-4 text-muted-foreground">
                            {row.mainTutorName ?? (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-muted border text-muted-foreground">新生</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}

          {rosterGroups.unassigned.length > 0 && (
            <div className="rounded-xl border border-dashed shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-muted/20 border-b">
                <span className="font-semibold text-sm text-muted-foreground">未分班</span>
                <span className="text-sm text-muted-foreground tabular-nums">{rosterGroups.unassigned.length} 人</span>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {rosterGroups.unassigned.map((row) => (
                    <tr key={row.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="py-2 px-4">
                        <p className="font-medium">{row.name}</p>
                        {row.englishName && <p className="text-xs text-muted-foreground">{row.englishName}</p>}
                      </td>
                      <td className="py-2 px-4 text-muted-foreground">{row.grade}</td>
                      <td className="py-2 px-4 text-muted-foreground">{row.campus ?? '—'}</td>
                      <td className="py-2 px-4 text-muted-foreground">
                        {row.mainTutorName ?? (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-muted border text-muted-foreground">新生</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {rosterGroups.byClass.every((c) => c.students.length === 0) && rosterGroups.unassigned.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">尚無分班資料</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
