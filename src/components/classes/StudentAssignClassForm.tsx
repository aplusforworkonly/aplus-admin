'use client';
import { useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getGrade } from '@/lib/grade';
import { updateClassStudents } from '@/actions/classes';
import { CAMPUSES } from '@/lib/constants';

type Student = {
  id: string;
  name: string;
  english_name: string | null;
  enrollment_date: string;
  status: string;
  campus: string | null;
};

const GRADES = ['大班升小一', '小一', '小二', '小三', '小四', '小五', '小六'];

function FilterBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex items-center justify-center whitespace-nowrap',
        'h-7 rounded-md border px-2.5 text-xs font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-input bg-background text-foreground hover:bg-accent',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function StudentList({
  students,
  selected,
  onToggle,
  emptyText,
  pendingSet,
}: {
  students: Student[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  emptyText?: string;
  pendingSet?: Set<string>;
}) {
  if (students.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-3 text-center">
        {emptyText ?? '無符合的學生'}
      </p>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-1">
      {students.map((s) => {
        const isPending = pendingSet?.has(s.id) ?? false;
        return (
          <label
            key={s.id}
            className={[
              'flex items-center gap-2 text-sm p-2 rounded cursor-pointer',
              isPending ? 'hover:bg-orange-50' : 'hover:bg-muted',
            ].join(' ')}
          >
            <input
              type="checkbox"
              checked={selected.has(s.id)}
              onChange={() => onToggle(s.id)}
              className="rounded shrink-0"
            />
            <span className="flex items-center gap-1 flex-wrap">
              {s.name}
              {s.english_name && (
                <span className="text-xs text-muted-foreground">{s.english_name}</span>
              )}
              {isPending && (
                <span className="inline-flex items-center text-[10px] font-semibold px-1 py-0.5 rounded bg-orange-100 text-orange-700 border border-orange-300">
                  待分班
                </span>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}

export default function StudentAssignClassForm({
  classId,
  allStudents,
  assignedIds,
  enrolledStudentIds,
  assignedElsewhereIds = [],
  hasCourse,
}: {
  classId: string;
  allStudents: Student[];
  assignedIds: string[];
  enrolledStudentIds: string[];
  assignedElsewhereIds?: string[];
  hasCourse: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(assignedIds));
  const [query, setQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [campusFilter, setCampusFilter] = useState('all');
  const [showOthers, setShowOthers] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const enrolledSet = new Set(enrolledStudentIds);
  // 已分到同課程其他班的學生，不計入「待分班」
  const assignedElsewhereSet = new Set(assignedElsewhereIds);

  // 全部待分班人數（不受篩選影響，用於頂部 Banner）
  // 排除：已在本班（selected）或已在同課程其他班（assignedElsewhereSet）
  const allPendingCount = enrolledStudentIds.filter(
    (id) => !selected.has(id) && !assignedElsewhereSet.has(id)
  ).length;

  const filtered = allStudents.filter((s) => {
    const matchName =
      s.name.includes(query) ||
      (s.english_name ?? '').toLowerCase().includes(query.toLowerCase());
    const matchGrade =
      gradeFilter === 'all' ||
      (s.status === '就讀中' && getGrade(s.enrollment_date) === gradeFilter);
    const matchCampus = campusFilter === 'all' || s.campus === campusFilter;
    return matchName && matchGrade && matchCampus;
  });

  const recommended = hasCourse ? filtered.filter((s) => enrolledSet.has(s.id)) : [];
  const others = hasCourse ? filtered.filter((s) => !enrolledSet.has(s.id)) : filtered;

  // 待分班排在最前面（同時排除已在其他班的學生）
  const pendingSet = new Set(
    recommended
      .filter((s) => !selected.has(s.id) && !assignedElsewhereSet.has(s.id))
      .map((s) => s.id)
  );
  const sortedRecommended = [
    ...recommended.filter((s) => pendingSet.has(s.id)),
    ...recommended.filter((s) => !pendingSet.has(s.id)),
  ];

  function toggle(id: string) {
    setSaved(false);
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAllRecommended() {
    setSaved(false);
    setSelected((prev) => {
      const next = new Set(prev);
      recommended.forEach((s) => next.add(s.id));
      return next;
    });
  }

  function handleSave() {
    startTransition(async () => {
      await updateClassStudents(classId, [...selected]);
      setSaved(true);
    });
  }

  return (
    <div className="space-y-3">
      {/* 待分班警示 Banner */}
      {hasCourse && allPendingCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-orange-300 bg-orange-50 px-3 py-2.5 text-sm text-orange-800">
          <span>⚠️</span>
          <span>
            注意：有 <span className="font-semibold">{allPendingCount}</span> 位已報名此課程的學生尚未入班！
          </span>
        </div>
      )}

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="搜尋中文或英文姓名..."
      />

      <div className="flex flex-wrap gap-1.5">
        <FilterBtn active={campusFilter === 'all'} onClick={() => setCampusFilter('all')}>
          全部校區
        </FilterBtn>
        {CAMPUSES.map((c) => (
          <FilterBtn key={c} active={campusFilter === c} onClick={() => setCampusFilter(c)}>
            {c}
          </FilterBtn>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <FilterBtn active={gradeFilter === 'all'} onClick={() => setGradeFilter('all')}>
          全部年級
        </FilterBtn>
        {GRADES.map((g) => (
          <FilterBtn key={g} active={gradeFilter === g} onClick={() => setGradeFilter(g)}>
            {g}
          </FilterBtn>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">已選 {selected.size} 位</p>

      {hasCourse ? (
        <>
          {/* 推薦名單 */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                推薦名單（已報名此課程 · {recommended.length} 位）
              </p>
              {recommended.length > 0 && (
                <button
                  type="button"
                  onClick={selectAllRecommended}
                  className="text-xs text-primary hover:underline underline-offset-2"
                >
                  全選（{recommended.length} 位）
                </button>
              )}
            </div>
            <div className="max-h-64 overflow-y-auto">
              <StudentList
                students={sortedRecommended}
                selected={selected}
                onToggle={toggle}
                pendingSet={pendingSet}
                emptyText={
                  query || gradeFilter !== 'all' || campusFilter !== 'all'
                    ? '篩選條件下無符合的推薦學生'
                    : '目前無已報名此課程的學生'
                }
              />
            </div>
          </div>

          {/* 其他學生（摺疊） */}
          <div className="rounded-lg border bg-background">
            <button
              type="button"
              onClick={() => setShowOthers((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50 rounded-lg"
            >
              <span>其他學生（{others.length} 位）</span>
              <span className="text-muted-foreground text-xs">{showOthers ? '▲ 收起' : '▼ 展開'}</span>
            </button>
            {showOthers && (
              <div className="px-3 pb-3 max-h-64 overflow-y-auto">
                <StudentList students={others} selected={selected} onToggle={toggle} />
              </div>
            )}
          </div>
        </>
      ) : (
        /* 無課程：維持原始單一列表 */
        <div className="max-h-80 overflow-y-auto">
          <StudentList students={others} selected={selected} onToggle={toggle} emptyText="找不到符合的學生" />
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={pending}>儲存</Button>
        {saved && <span className="text-sm text-green-700">已儲存</span>}
      </div>
    </div>
  );
}
