'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getGrade } from '@/lib/grade';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { StudentWithParents } from '@/lib/supabase/types';

// 統一篩選按鈕：active/inactive 只改顏色，border/padding/height 完全相同
function FilterBtn({
  active,
  onClick,
  children,
  className = '',
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex items-center justify-center whitespace-nowrap',
        'h-8 rounded-md border px-3',
        'text-xs font-medium',
        'transition-colors',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground',
        className,
      ].join(' ')}
    >
      {children}
    </button>
  );
}

export default function StudentTable({
  initialStudents,
}: {
  initialStudents: StudentWithParents[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | '就讀中' | '已離校'>('all');
  const [campusFilter, setCampusFilter] = useState<'all' | '文府總校' | '龍華校' | '左新校'>('all');
  const [gradeFilter, setGradeFilter] = useState<string>('all');

  const GRADES = ['大班升小一', '小一', '小二', '小三', '小四', '小五', '小六'];

  const filtered = initialStudents.filter((s) => {
    const matchSearch =
      !search ||
      s.name?.includes(search) ||
      s.english_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.id_number?.includes(search) ||
      s.parent_student_mapping?.some((m) => m.parents?.name?.includes(search));
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    const matchCampus = campusFilter === 'all' || s.campus === campusFilter;
    const matchGrade =
      gradeFilter === 'all' ||
      (s.status === '就讀中' && getGrade(s.enrollment_date) === gradeFilter);
    return matchSearch && matchStatus && matchCampus && matchGrade;
  });

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center flex-wrap">
        <Input
          placeholder="搜尋姓名、英文名、身分證、家長姓名..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex gap-1">
          {(['all', '就讀中', '已離校'] as const).map((s) => (
            <FilterBtn key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>
              {s === 'all' ? '全部狀態' : s}
            </FilterBtn>
          ))}
        </div>
        <div className="flex gap-1">
          {(['all', '文府總校', '龍華校', '左新校'] as const).map((c) => (
            <FilterBtn key={c} active={campusFilter === c} onClick={() => setCampusFilter(c)}>
              {c === 'all' ? '全部校區' : c}
            </FilterBtn>
          ))}
        </div>
        <span className="text-sm text-muted-foreground ml-auto">{filtered.length} 筆</span>
        <Button onClick={() => router.push('/students/new')}>＋ 新增學生</Button>
      </div>

      <div className="flex gap-1 flex-wrap">
        {(['all', ...GRADES] as const).map((g) => (
          <FilterBtn
            key={g}
            active={gradeFilter === g}
            onClick={() => setGradeFilter(g)}
            className="w-24"
          >
            {g === 'all' ? '全部年級' : g}
          </FilterBtn>
        ))}
      </div>

      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead>姓名</TableHead>
            <TableHead className="w-24">校區</TableHead>
            <TableHead className="w-20">年級</TableHead>
            <TableHead className="w-36">身分證字號</TableHead>
            <TableHead className="w-24">狀態</TableHead>
            <TableHead className="w-32">入學日期</TableHead>
            <TableHead className="w-16"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                沒有符合條件的學生
              </TableCell>
            </TableRow>
          )}
          {filtered.map((student) => (
            <TableRow key={student.id}>
              <TableCell>
                <div className="font-medium">{student.name}</div>
                {student.english_name && (
                  <div className="text-xs text-muted-foreground">{student.english_name}</div>
                )}
              </TableCell>
              <TableCell className="text-sm">{student.campus ?? '—'}</TableCell>
              <TableCell className="text-sm">
                {student.status === '就讀中' ? getGrade(student.enrollment_date) : '—'}
              </TableCell>
              <TableCell className="text-muted-foreground font-mono text-xs">
                {student.id_number ?? '—'}
              </TableCell>
              <TableCell>
                <Badge variant={student.status === '就讀中' ? 'default' : 'secondary'}>
                  {student.status}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">{student.enrollment_date}</TableCell>
              <TableCell>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/students/${student.id}`)}
                >
                  編輯
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
