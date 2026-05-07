'use client';
import { useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { updateEnrollmentStatus } from '@/actions/enrollments';
import type { EnrollmentStatus, CampusType } from '@/lib/supabase/types';

type EnrollmentRow = {
  id: string;
  student_id: string;
  contract_no: string;
  campus: CampusType;
  start_date: string;
  end_date: string | null;
  status: EnrollmentStatus;
  students: { name: string } | null;
  courses: { name: string } | null;
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  生效: 'default',
  候補: 'outline',
  待審核: 'secondary',
  退班: 'destructive',
  已結業: 'secondary',
};

const NEXT_STATUS: Partial<Record<EnrollmentStatus, EnrollmentStatus>> = {
  候補: '生效',
  生效: '退班',
  待審核: '生效',
};

const NEXT_LABEL: Partial<Record<EnrollmentStatus, string>> = {
  候補: '轉生效',
  生效: '退班',
  待審核: '核准',
};

function FilterBtn({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex items-center justify-center whitespace-nowrap h-8 rounded-md border px-3 text-xs font-medium transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

export default function EnrollmentTable({
  enrollments,
  classes = [],
  classStudentIds = {},
}: {
  enrollments: EnrollmentRow[];
  classes?: { id: string; label: string }[];
  classStudentIds?: Record<string, string[]>;
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | EnrollmentStatus>('all');
  const [campusFilter, setCampusFilter] = useState<'all' | CampusType>('all');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [pending, startTransition] = useTransition();

  const filtered = enrollments.filter((e) => {
    const matchSearch =
      !search ||
      e.students?.name?.includes(search) ||
      e.contract_no.includes(search) ||
      e.courses?.name?.includes(search);
    const matchStatus = statusFilter === 'all' || e.status === statusFilter;
    const matchCampus = campusFilter === 'all' || e.campus === campusFilter;
    const matchClass =
      classFilter === 'all' ||
      (classStudentIds[classFilter]?.includes(e.student_id) ?? false);
    return matchSearch && matchStatus && matchCampus && matchClass;
  });

  function handleStatusChange(id: string, next: EnrollmentStatus) {
    startTransition(() => updateEnrollmentStatus(id, next));
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center flex-wrap">
        <Input
          placeholder="搜尋學生、課程、合約編號..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex gap-1">
          {(['all', '待審核', '生效', '候補', '退班', '已結業'] as const).map((s) => (
            <FilterBtn key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>
              {s === 'all' ? '全部' : s}
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
        {classes.length > 0 && (
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder="全部班級" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部班級</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <span className="text-sm text-muted-foreground ml-auto">{filtered.length} 筆</span>
      </div>
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-36">合約編號</TableHead>
            <TableHead>學生</TableHead>
            <TableHead>課程</TableHead>
            <TableHead className="w-24">校區</TableHead>
            <TableHead className="w-28">開始日期</TableHead>
            <TableHead className="w-20">狀態</TableHead>
            <TableHead className="w-32"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                沒有符合條件的報名
              </TableCell>
            </TableRow>
          )}
          {filtered.map((e) => {
            const next = NEXT_STATUS[e.status];
            return (
              <TableRow key={e.id}>
                <TableCell className="font-mono text-xs">{e.contract_no}</TableCell>
                <TableCell className="font-medium text-sm">{e.students?.name ?? '—'}</TableCell>
                <TableCell className="text-sm">{e.courses?.name ?? '—'}</TableCell>
                <TableCell className="text-sm">{e.campus}</TableCell>
                <TableCell className="text-sm">{e.start_date}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[e.status] ?? 'secondary'}>{e.status}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {next && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() => handleStatusChange(e.id, next)}
                      >
                        {NEXT_LABEL[e.status]}
                      </Button>
                    )}
                    {e.status === '待審核' && (
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={pending}
                        onClick={() => handleStatusChange(e.id, '退班')}
                      >
                        拒絕
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
