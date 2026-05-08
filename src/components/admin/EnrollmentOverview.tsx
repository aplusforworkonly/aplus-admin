'use client';
import { useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { batchAssignTutors } from '@/actions/students';

export type TutorOption = { id: string; name: string; campus: string; department: string | null };

export type EnrollmentRow = {
  id: string;
  name: string;
  englishName: string | null;
  grade: string;
  campus: string;
  mainTutorId: string;
  mainTutorName: string;
  mainTutorCampus: string | null;
  julyEnrollments: string[];
  augustEnrollments: string[];
  leaves: { date: string; endDate: string | null; note: string | null }[];
  leaveNote: string | null;
  registrationNote: string | null;
  hasClass: boolean;
  programType: string | null;
  isSchoolStudent: boolean;
};

const CAMPUSES = ['文府總校', '龍華校', '左新校'];
const PROGRAM_TYPES = ['全日班', '單上英語', '其他'];

const GRADE_ORDER: Record<string, number> = {
  '大班升小一': 0, '小一': 1, '小二': 2, '小三': 3, '小四': 4, '小五': 5, '小六': 6, '已畢業': 7,
};
const CAMPUS_ORDER: Record<string, number> = { '文府總校': 0, '龍華校': 1, '左新校': 2 };

// 依學制決定對應的老師部門
function deptForProgramType(pt: string | null): string | null {
  if (pt === '全日班') return '教學部';
  if (pt === '單上英語') return '英語部';
  return null;
}

function ProgressDot({ done, label }: { done: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full border ${
      done ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'
    }`}>
      {done ? '✓' : '✗'} {label}
    </span>
  );
}

function ProgramBadge({ type }: { type: string | null }) {
  if (!type || type === '其他') return null;
  const cls = type === '全日班'
    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
    : 'bg-teal-50 text-teal-700 border-teal-200';
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded border ${cls}`}>{type}</span>
  );
}

function CourseList({ courses, month }: { courses: string[]; month: '七月' | '八月' }) {
  if (courses.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const color = month === '七月'
    ? 'bg-blue-50 text-blue-700 border-blue-200'
    : 'bg-amber-50 text-amber-700 border-amber-200';
  return (
    <div className="flex flex-col gap-1">
      {courses.map((name) => (
        <span key={name} className={`text-xs px-2 py-0.5 rounded-full border w-fit ${color}`}>
          {name}
        </span>
      ))}
    </div>
  );
}

function LeaveList({ leaves }: { leaves: EnrollmentRow['leaves'] }) {
  if (leaves.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex flex-col gap-1">
      {leaves.map((l, i) => (
        <span key={i} className="text-xs text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full w-fit">
          {l.endDate && l.endDate !== l.date ? `${l.date} ～ ${l.endDate}` : l.date}
          {l.note && <span className="ml-1 text-orange-500">({l.note})</span>}
        </span>
      ))}
    </div>
  );
}

export default function EnrollmentOverview({
  rows,
  tutorOptions,
}: {
  rows: EnrollmentRow[];
  tutorOptions: TutorOption[];
}) {
  const [search, setSearch] = useState('');
  const [campusFilter, setCampusFilter] = useState('all');
  const [tutorFilter, setTutorFilter] = useState('all');
  const [programTypeFilter, setProgramTypeFilter] = useState('all');
  const [sortKey, setSortKey] = useState<'name' | 'grade' | 'campus'>('name');
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [onlySchoolStudents, setOnlySchoolStudents] = useState(false);

  // Assignment mode
  const [assignMode, setAssignMode] = useState(false);
  const [pendingTutors, setPendingTutors] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchTutorId, setBatchTutorId] = useState('');
  const [saving, startSave] = useTransition();

  function handleCampusChange(val: string) {
    setCampusFilter(val);
    setTutorFilter('all');
  }

  function handleOnlyUnassignedChange(checked: boolean) {
    setOnlyUnassigned(checked);
    if (checked) setTutorFilter('all');
  }

  function toggleAssignMode() {
    setAssignMode((prev) => !prev);
    setPendingTutors({});
    setSelected(new Set());
    setBatchTutorId('');
  }

  // 篩選列用的導師選單：依校區 + 學制篩選
  const filteredTutorOptions = tutorOptions.filter((t) => {
    const matchCampus = campusFilter === 'all' || t.campus === campusFilter;
    const dept = deptForProgramType(programTypeFilter === 'all' ? null : programTypeFilter);
    const matchDept = !dept || t.department === dept;
    return matchCampus && matchDept;
  });

  const filtered = rows
    .filter((r) => {
      const matchSearch = !search.trim()
        || r.name.includes(search.trim())
        || (r.englishName ?? '').toLowerCase().includes(search.trim().toLowerCase());
      const matchCampus = campusFilter === 'all' || r.campus === campusFilter;
      const matchTutor = tutorFilter === 'all' || r.mainTutorId === tutorFilter;
      const matchProgram = programTypeFilter === 'all' || r.programType === programTypeFilter;
      const matchUnassigned = !onlyUnassigned || !r.mainTutorId;
      const matchSchool = !onlySchoolStudents || r.isSchoolStudent;
      return matchSearch && matchCampus && matchTutor && matchProgram && matchUnassigned && matchSchool;
    })
    .sort((a, b) => {
      if (sortKey === 'grade') return (GRADE_ORDER[a.grade] ?? 99) - (GRADE_ORDER[b.grade] ?? 99);
      if (sortKey === 'campus') return (CAMPUS_ORDER[a.campus] ?? 99) - (CAMPUS_ORDER[b.campus] ?? 99);
      return a.name.localeCompare(b.name, 'zh-TW');
    });

  const allFilteredIds = filtered.map((r) => r.id);
  const allChecked = allFilteredIds.length > 0 && allFilteredIds.every((id) => selected.has(id));
  const pendingCount = Object.keys(pendingTutors).length;

  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(allFilteredIds));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function applyBatch() {
    if (!batchTutorId) return;
    setPendingTutors((prev) => {
      const next = { ...prev };
      for (const id of selected) next[id] = batchTutorId;
      return next;
    });
  }

  function handleSave() {
    const assignments = Object.entries(pendingTutors).map(([studentId, tutorId]) => ({
      studentId,
      tutorId: tutorId || null,
    }));
    startSave(async () => {
      await batchAssignTutors(assignments);
      setPendingTutors({});
      setSelected(new Set());
      setAssignMode(false);
    });
  }

  const selectCls = 'h-8 rounded-md border border-input bg-background px-2 text-sm';
  const isFiltered = search || campusFilter !== 'all' || tutorFilter !== 'all'
    || programTypeFilter !== 'all' || onlyUnassigned || onlySchoolStudents;

  return (
    <div className="space-y-3">
      {/* Filters row */}
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          placeholder="搜尋學生姓名…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs h-8 text-sm"
        />
        <select className={selectCls} value={campusFilter} onChange={(e) => handleCampusChange(e.target.value)}>
          <option value="all">全部校區</option>
          {CAMPUSES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          className={selectCls}
          value={programTypeFilter}
          onChange={(e) => { setProgramTypeFilter(e.target.value); setTutorFilter('all'); }}
        >
          <option value="all">全部學制</option>
          {PROGRAM_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select
          className={selectCls}
          value={tutorFilter}
          disabled={onlyUnassigned}
          onChange={(e) => setTutorFilter(e.target.value)}
        >
          <option value="all">全部總導師</option>
          {filteredTutorOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select className={selectCls} value={sortKey} onChange={(e) => setSortKey(e.target.value as 'name' | 'grade' | 'campus')}>
          <option value="name">排序：姓名</option>
          <option value="grade">排序：年級</option>
          <option value="campus">排序：校區</option>
        </select>
      </div>
      <div className="flex items-center gap-4 flex-wrap">
        <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
          <input type="checkbox" className="rounded" checked={onlyUnassigned} onChange={(e) => handleOnlyUnassignedChange(e.target.checked)} />
          只看未指定導師
        </label>
        <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
          <input type="checkbox" className="rounded" checked={onlySchoolStudents} onChange={(e) => setOnlySchoolStudents(e.target.checked)} />
          只看在校生
        </label>
        <span className="text-xs text-muted-foreground ml-auto">
          {isFiltered ? `${filtered.length} / ${rows.length} 人` : `共 ${rows.length} 人`}
        </span>
        <Button variant={assignMode ? 'default' : 'outline'} size="sm" onClick={toggleAssignMode}>
          {assignMode ? '取消分配' : '分配總導師'}
        </Button>
      </div>

      {/* Assignment toolbar */}
      {assignMode && (
        <div className="flex items-center gap-3 bg-muted/50 border rounded-lg px-4 py-2 flex-wrap">
          {selected.size > 0 ? (
            <>
              <span className="text-sm font-medium text-muted-foreground">批次設定 {selected.size} 人：</span>
              <select
                className={selectCls}
                value={batchTutorId}
                onChange={(e) => setBatchTutorId(e.target.value)}
              >
                <option value="">選擇總導師…</option>
                {filteredTutorOptions.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <Button size="sm" variant="outline" onClick={applyBatch} disabled={!batchTutorId}>
                套用
              </Button>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">勾選學生後可批次指派總導師</span>
          )}
          {pendingCount > 0 && (
            <Button size="sm" onClick={handleSave} disabled={saving} className="ml-auto">
              {saving ? '儲存中...' : `儲存 ${pendingCount} 筆變更`}
            </Button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {assignMode && (
                <TableHead className="w-10">
                  <input type="checkbox" checked={allChecked} onChange={toggleAll} className="rounded" />
                </TableHead>
              )}
              <TableHead className="w-36">姓名</TableHead>
              <TableHead className="w-20">年級</TableHead>
              <TableHead className="w-40">總導師</TableHead>
              <TableHead>七月課程</TableHead>
              <TableHead>八月課程</TableHead>
              <TableHead className="w-44">請假日期</TableHead>
              <TableHead className="w-28">入班進度</TableHead>
              <TableHead className="w-44">備註</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={assignMode ? 9 : 8} className="text-center text-muted-foreground py-8">
                  {isFiltered ? '找不到符合的學生' : '目前無學生資料'}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((r) => {
              const hasCourse = r.julyEnrollments.length > 0 || r.augustEnrollments.length > 0;
              const hasTutor = !!r.mainTutorId;
              const isPending = r.id in pendingTutors;
              const effectiveTutorId = isPending ? pendingTutors[r.id] : r.mainTutorId;
              const effectiveTutorName = isPending
                ? (tutorOptions.find((t) => t.id === pendingTutors[r.id])?.name ?? '')
                : r.mainTutorName;

              // 個別 dropdown：依校區 + 學制雙重過濾
              const dept = deptForProgramType(r.programType);
              const rowTutors = tutorOptions.filter((t) => {
                const matchCampus = !r.campus || t.campus === r.campus;
                const matchDept = !dept || t.department === dept;
                return matchCampus && matchDept;
              });

              return (
                <TableRow key={r.id} className={isPending ? 'bg-yellow-50' : undefined}>
                  {assignMode && (
                    <TableCell>
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={selected.has(r.id)}
                        onChange={() => toggleOne(r.id)}
                      />
                    </TableCell>
                  )}
                  <TableCell className="text-sm">
                    <p className="font-medium">{r.name}</p>
                    {r.englishName && (
                      <p className="text-xs text-muted-foreground">{r.englishName}</p>
                    )}
                    <div className="flex gap-1 mt-0.5 flex-wrap">
                      <ProgramBadge type={r.programType} />
                      {r.isSchoolStudent && (
                        <span className="text-xs px-1.5 py-0.5 rounded border bg-slate-50 text-slate-600 border-slate-200">在校</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.grade}</TableCell>
                  <TableCell className="text-sm">
                    {assignMode ? (
                      <select
                        className="h-7 rounded border border-input bg-background px-1.5 text-xs w-full"
                        value={effectiveTutorId}
                        onChange={(e) =>
                          setPendingTutors((prev) => ({ ...prev, [r.id]: e.target.value }))
                        }
                      >
                        <option value="">— 未指定 —</option>
                        {rowTutors.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    ) : (
                      effectiveTutorName || (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-muted border text-muted-foreground">
                          新生
                        </span>
                      )
                    )}
                  </TableCell>
                  <TableCell>
                    <CourseList courses={r.julyEnrollments} month="七月" />
                  </TableCell>
                  <TableCell>
                    <CourseList courses={r.augustEnrollments} month="八月" />
                  </TableCell>
                  <TableCell>
                    <LeaveList leaves={r.leaves} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <ProgressDot done={hasCourse} label="課程" />
                      <ProgressDot done={hasTutor} label="導師" />
                      <ProgressDot done={r.hasClass} label="分班" />
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground space-y-1">
                    {r.registrationNote && (
                      <p><span className="text-foreground font-medium">家長：</span>{r.registrationNote}</p>
                    )}
                    {r.leaveNote && (
                      <p><span className="text-foreground font-medium">行政：</span>{r.leaveNote}</p>
                    )}
                    {!r.registrationNote && !r.leaveNote && '—'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
