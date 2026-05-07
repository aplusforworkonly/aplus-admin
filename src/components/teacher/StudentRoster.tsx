'use client';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

export type StudentRow = {
  id: string;
  name: string;
  classes: string[];
  julyEnrollments: string[];
  augustEnrollments: string[];
  leaves: { date: string; endDate: string | null; note: string | null }[];
  leaveNote: string | null;
  registrationNote: string | null;
};

function CourseList({ courses, month }: { courses: string[]; month: '七月' | '八月' }) {
  if (courses.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
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


export default function StudentRoster({ rows }: { rows: StudentRow[] }) {
  const [q, setQ] = useState('');
  const filtered = q.trim()
    ? rows.filter((r) => r.name.includes(q.trim()))
    : rows;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Input
          placeholder="搜尋學生姓名…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs h-8 text-sm"
        />
        <span className="text-xs text-muted-foreground">
          {q ? `${filtered.length} / ${rows.length} 人` : `共 ${rows.length} 人`}
        </span>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">學生姓名</TableHead>
              <TableHead className="w-32">所屬班級</TableHead>
              <TableHead>七月課程</TableHead>
              <TableHead>八月課程</TableHead>
              <TableHead className="w-40">預填請假日期</TableHead>
              <TableHead className="w-40">其他備註</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  {q ? '找不到符合的學生' : '目前無學生資料'}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium text-sm">{r.name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.classes.join('、') || '—'}
                </TableCell>
                <TableCell>
                  <CourseList courses={r.julyEnrollments} month="七月" />
                </TableCell>
                <TableCell>
                  <CourseList courses={r.augustEnrollments} month="八月" />
                </TableCell>
                <TableCell className="text-sm">
                  {r.leaveNote ?? <span className="text-xs text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-sm">
                  {r.registrationNote ?? <span className="text-xs text-muted-foreground">—</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
