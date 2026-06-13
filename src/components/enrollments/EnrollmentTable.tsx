'use client';
import { useState, useRef, useEffect, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
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
  students: { name: string; english_name?: string | null } | null;
  courses: { name: string } | null;
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  生效: 'default', 候補: 'outline', 退班: 'destructive', 已結業: 'secondary',
};

const NEXT_STATUS: Partial<Record<EnrollmentStatus, EnrollmentStatus>> = {
  候補: '生效', 生效: '退班',
};

const NEXT_LABEL: Partial<Record<EnrollmentStatus, string>> = {
  候補: '轉生效', 生效: '退班',
};

const DEFAULT_STATUS = '生效,候補';

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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
  totalCount,
  currentPage,
  pageSize,
}: {
  enrollments: EnrollmentRow[];
  classes?: { id: string; label: string }[];
  classStudentIds?: Record<string, string[]>;
  totalCount: number;
  currentPage: number;
  pageSize: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParam = searchParams.get('search') ?? '';
  const [inputValue, setInputValue] = useState(searchParam);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [classFilter, setClassFilter] = useState<string>('all');
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setInputValue(searchParam);
  }, [searchParam]);

  useEffect(() => {
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, []);

  const statusParam = searchParams.get('status') ?? DEFAULT_STATUS;
  const campusParam = searchParams.get('campus') ?? 'all';
  const totalPages = Math.ceil(totalCount / pageSize);

  function navigate(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    if (!('page' in updates)) params.set('page', '1');
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  function handleStatusChange(id: string, next: EnrollmentStatus) {
    startTransition(() => updateEnrollmentStatus(id, next));
  }

  const filtered = enrollments.filter((e) => {
    const matchSearch =
      !searchParam ||
      e.students?.name?.includes(searchParam) ||
      e.students?.english_name?.includes(searchParam) ||
      e.contract_no.includes(searchParam) ||
      e.courses?.name?.includes(searchParam);
    const matchClass =
      classFilter === 'all' ||
      (classStudentIds[classFilter]?.includes(e.student_id) ?? false);
    return matchSearch && matchClass;
  });

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center flex-wrap">
        <Input
          placeholder="搜尋學生、課程、合約編號..."
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            if (searchTimer.current) clearTimeout(searchTimer.current);
            searchTimer.current = setTimeout(() => {
              navigate({ search: e.target.value || null });
            }, 400);
          }}
          className="max-w-xs"
        />

        <div className="flex gap-1 flex-wrap">
          {([
            { value: DEFAULT_STATUS, label: '進行中' },
            { value: '生效', label: '生效' },
            { value: '候補', label: '候補' },
            { value: '退班', label: '退班' },
            { value: '已結業', label: '已結業' },
            { value: 'all', label: '全部' },
          ] as const).map(({ value, label }) => (
            <FilterBtn key={value} active={statusParam === value} onClick={() => navigate({ status: value })}>
              {label}
            </FilterBtn>
          ))}
        </div>

        <div className="flex gap-1">
          {(['all', '文府總校', '龍華校', '左新校'] as const).map((c) => (
            <FilterBtn key={c} active={campusParam === c} onClick={() => navigate({ campus: c })}>
              {c === 'all' ? '全部校區' : c}
            </FilterBtn>
          ))}
        </div>

        {classes.length > 0 && (
          <Select value={classFilter} onValueChange={(v) => setClassFilter(v ?? 'all')}>
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

        <span className="text-sm text-muted-foreground ml-auto">{filtered.length} / {totalCount} 筆</span>
      </div>

      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-44">合約編號</TableHead>
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
                <TableCell className="font-mono text-xs max-w-[11rem]">
                  <span className="block truncate" title={e.contract_no}>{e.contract_no}</span>
                </TableCell>
                <TableCell className="font-medium text-sm">
                  <p>{e.students?.name ?? '—'}</p>
                  {e.students?.english_name && (
                    <p className="text-xs text-muted-foreground font-normal">{e.students.english_name}</p>
                  )}
                </TableCell>
                <TableCell className="text-sm">{e.courses?.name ?? '—'}</TableCell>
                <TableCell className="text-sm">{e.campus}</TableCell>
                <TableCell className="text-sm">{e.start_date}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[e.status] ?? 'secondary'}>{e.status}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {next && (
                      <Button variant="outline" size="sm" disabled={pending} onClick={() => handleStatusChange(e.id, next)}>
                        {NEXT_LABEL[e.status]}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1 || pending}
            onClick={() => navigate({ page: String(currentPage - 1) })}
          >
            上一頁
          </Button>
          <span className="text-sm text-muted-foreground">第 {currentPage} / {totalPages} 頁</span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages || pending}
            onClick={() => navigate({ page: String(currentPage + 1) })}
          >
            下一頁
          </Button>
        </div>
      )}
    </div>
  );
}
