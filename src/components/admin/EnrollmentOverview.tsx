'use client';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

export type EnrollmentRow = {
  id: string;
  name: string;
  grade: string;
  mainTutorId: string;
  mainTutorName: string;
  julyEnrollments: string[];
  augustEnrollments: string[];
  leaves: { date: string; endDate: string | null; note: string | null }[];
  leaveNote: string | null;
  registrationNote: string | null;
};

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
  tutorOptions: { id: string; name: string }[];
}) {
  const [search, setSearch] = useState('');
  const [tutorFilter, setTutorFilter] = useState('all');

  const filtered = rows.filter((r) => {
    const matchSearch = !search.trim() || r.name.includes(search.trim());
    const matchTutor = tutorFilter === 'all' || r.mainTutorId === tutorFilter;
    return matchSearch && matchTutor;
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
          value={tutorFilter}
          onChange={(e) => setTutorFilter(e.target.value)}
        >
          <option value="all">全部總導師</option>
          {tutorOptions.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground ml-auto">
          {search || tutorFilter !== 'all'
            ? `${filtered.length} / ${rows.length} 人`
            : `共 ${rows.length} 人`}
        </span>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">姓名</TableHead>
              <TableHead className="w-20">年級</TableHead>
              <TableHead className="w-24">總導師</TableHead>
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
                  {search || tutorFilter !== 'all' ? '找不到符合的學生' : '目前無學生資料'}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium text-sm">{r.name}</TableCell>
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
