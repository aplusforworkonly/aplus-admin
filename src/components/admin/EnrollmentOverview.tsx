'use client';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

export type TutorOption = { id: string; name: string; campus: string };

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
};

const CAMPUSES = ['文府總校', '龍華校', '左新校'];

const GRADE_ORDER: Record<string, number> = {
  '大班升小一': 0, '小一': 1, '小二': 2, '小三': 3, '小四': 4, '小五': 5, '小六': 6, '已畢業': 7,
};
const CAMPUS_ORDER: Record<string, number> = { '文府總校': 0, '龍華校': 1, '左新校': 2 };

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
  const [sortKey, setSortKey] = useState<'name' | 'grade' | 'campus'>('name');

  // 切換校區時重置總導師篩選
  function handleCampusChange(val: string) {
    setCampusFilter(val);
    setTutorFilter('all');
  }

  // 依校區過濾後的總導師選項
  const filteredTutorOptions = campusFilter === 'all'
    ? tutorOptions
    : tutorOptions.filter((t) => t.campus === campusFilter);

  const filtered = rows
    .filter((r) => {
      const matchSearch = !search.trim() || r.name.includes(search.trim()) || (r.englishName ?? '').toLowerCase().includes(search.trim().toLowerCase());
      const matchCampus = campusFilter === 'all' || r.campus === campusFilter;
      const matchTutor = tutorFilter === 'all' || r.mainTutorId === tutorFilter;
      return matchSearch && matchCampus && matchTutor;
    })
    .sort((a, b) => {
      if (sortKey === 'grade') return (GRADE_ORDER[a.grade] ?? 99) - (GRADE_ORDER[b.grade] ?? 99);
      if (sortKey === 'campus') return (CAMPUS_ORDER[a.campus] ?? 99) - (CAMPUS_ORDER[b.campus] ?? 99);
      return a.name.localeCompare(b.name, 'zh-TW');
    });

  const selectCls = 'h-8 rounded-md border border-input bg-background px-2 text-sm';

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          placeholder="搜尋學生姓名…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs h-8 text-sm"
        />
        <select
          className={selectCls}
          value={campusFilter}
          onChange={(e) => handleCampusChange(e.target.value)}
        >
          <option value="all">全部校區</option>
          {CAMPUSES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          className={selectCls}
          value={tutorFilter}
          onChange={(e) => setTutorFilter(e.target.value)}
        >
          <option value="all">全部總導師</option>
          {filteredTutorOptions.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <select
          className={selectCls}
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as 'name' | 'grade' | 'campus')}
        >
          <option value="name">排序：姓名</option>
          <option value="grade">排序：年級</option>
          <option value="campus">排序：校區</option>
        </select>
        <span className="text-xs text-muted-foreground ml-auto">
          {search || campusFilter !== 'all' || tutorFilter !== 'all'
            ? `${filtered.length} / ${rows.length} 人`
            : `共 ${rows.length} 人`}
        </span>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">姓名</TableHead>
              <TableHead className="w-20">年級</TableHead>
              <TableHead className="w-32">總導師</TableHead>
              <TableHead>七月課程</TableHead>
              <TableHead>八月課程</TableHead>
              <TableHead className="w-44">請假日期</TableHead>
              <TableHead className="w-44">備註</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  {search || campusFilter !== 'all' || tutorFilter !== 'all'
                    ? '找不到符合的學生'
                    : '目前無學生資料'}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-sm">
                  <p className="font-medium">{r.name}</p>
                  {r.englishName && (
                    <p className="text-xs text-muted-foreground">{r.englishName}</p>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.grade}</TableCell>
                <TableCell className="text-sm">
                  {r.mainTutorName || (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-muted border text-muted-foreground">新生</span>
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
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
