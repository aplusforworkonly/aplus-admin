'use client';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

export type StudentRow = {
  id: string;
  name: string;
  englishName: string | null;
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
    ? 'bg-[#F2F5F3] text-[#344E41] border-[#DADFDA]' // Premium Sage Green
    : 'bg-[#F8F9FA] text-[#495057] border-[#E9ECEF]'; // Elegant Neutral Slate
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
    ? rows.filter((r) => r.name.includes(q.trim()) || (r.englishName ?? '').toLowerCase().includes(q.trim().toLowerCase()))
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

      {/* 手機：卡片堆疊 */}
      <div className="sm:hidden space-y-3">
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-8 text-sm">
            {q ? '找不到符合的學生' : '目前無學生資料'}
          </p>
        )}
        {filtered.map((r) => (
          <div key={r.id} className="rounded-lg border p-4 space-y-3">
            <div>
              <p className="font-semibold text-base">{r.name}</p>
              {r.englishName && <p className="text-xs text-muted-foreground">{r.englishName}</p>}
              <div className="mt-2 inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                {r.classes.length > 0 ? `班級：${r.classes.join('、')}` : '班級：尚未分配'}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">七月課程</p>
                <CourseList courses={r.julyEnrollments} month="七月" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">八月課程</p>
                <CourseList courses={r.augustEnrollments} month="八月" />
              </div>
            </div>
            <div className="border-t pt-2 space-y-1">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium">預填請假日期：</span>{r.leaveNote ?? '—'}
              </p>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium">其他備註：</span>{r.registrationNote ?? '—'}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* 桌機：Table */}
      <div className="hidden sm:block rounded-lg border overflow-hidden">
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
                <TableCell className="text-sm">
                  <p className="font-medium">{r.name}</p>
                  {r.englishName && <p className="text-xs text-muted-foreground">{r.englishName}</p>}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.classes.length > 0 ? (
                    <span className="text-slate-700">{r.classes.join('、')}</span>
                  ) : (
                    <span className="text-slate-400 italic">尚未分配</span>
                  )}
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
