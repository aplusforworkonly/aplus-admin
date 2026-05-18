'use client';
import { Fragment, useState, useTransition } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { generateMonthlyInvoices, rebillStudent } from '@/actions/invoices';
import { useRouter } from 'next/navigation';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

const GRADE_ORDER = ['大班升小一', '小一', '小二', '小三', '小四', '小五', '小六'];

type SortKey = 'studentName' | 'grade' | 'campus' | 'tutorName' | 'leaveDays' | 'total';

function sortRows(rows: BillingRow[], key: SortKey, dir: 'asc' | 'desc'): BillingRow[] {
  return [...rows].sort((a, b) => {
    let cmp = 0;
    if (key === 'grade') {
      const ai = GRADE_ORDER.indexOf(a.grade ?? '');
      const bi = GRADE_ORDER.indexOf(b.grade ?? '');
      cmp = (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    } else if (key === 'leaveDays' || key === 'total') {
      cmp = (a[key] ?? 0) - (b[key] ?? 0);
    } else {
      cmp = (a[key] ?? '').localeCompare(b[key] ?? '', 'zh-TW');
    }
    return dir === 'asc' ? cmp : -cmp;
  });
}

export type BillingRow = {
  studentId: string;
  studentName: string;
  studentEnglishName?: string;
  isSchoolStudent: boolean;
  campus?: string;
  grade?: string;
  tutorName?: string;
  courseNames: string[];
  leaveDays: number;
  items: { name: string; amount: number }[];
  total: number;
  billed: boolean;
};

export default function BillingPreviewTable({
  billingMonth,
  rows,
}: {
  billingMonth: string;
  rows: BillingRow[];
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('studentName');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [rebilling, setRebilling] = useState<Set<string>>(new Set());
  const router = useRouter();

  const newCount = rows.filter((r) => !r.billed).length;

  async function handleRebill(studentId: string) {
    setRebilling((prev) => new Set(prev).add(studentId));
    try {
      await rebillStudent(studentId, billingMonth);
      router.refresh();
    } finally {
      setRebilling((prev) => { const s = new Set(prev); s.delete(studentId); return s; });
    }
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronsUpDown className="inline w-3 h-3 ml-0.5 opacity-30" />;
    return sortDir === 'asc'
      ? <ChevronUp className="inline w-3 h-3 ml-0.5" />
      : <ChevronDown className="inline w-3 h-3 ml-0.5" />;
  }

  const sortedRows = sortRows(rows, sortKey, sortDir);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleGenerate() {
    startTransition(async () => {
      const res = await generateMonthlyInvoices(billingMonth);
      setResult(res);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border overflow-x-auto">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort('studentName')}>學生<SortIcon col="studentName" /></TableHead>
              <TableHead className="w-16 cursor-pointer select-none" onClick={() => handleSort('grade')}>年級<SortIcon col="grade" /></TableHead>
              <TableHead className="w-20 cursor-pointer select-none" onClick={() => handleSort('campus')}>校區<SortIcon col="campus" /></TableHead>
              <TableHead className="w-24 cursor-pointer select-none" onClick={() => handleSort('tutorName')}>總導師<SortIcon col="tutorName" /></TableHead>
              <TableHead className="w-20">校內生</TableHead>
              <TableHead className="max-w-[220px]">課程</TableHead>
              <TableHead className="w-16 text-center cursor-pointer select-none" onClick={() => handleSort('leaveDays')}>請假天<SortIcon col="leaveDays" /></TableHead>
              <TableHead className="w-28 text-right cursor-pointer select-none" onClick={() => handleSort('total')}>應收金額<SortIcon col="total" /></TableHead>
              <TableHead className="w-20 text-center">狀態</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.map((row) => {
              const isOpen = expanded.has(row.studentId);
              const positives = row.items.filter((i) => i.amount > 0);
              const negatives = row.items.filter((i) => i.amount < 0);
              return (
                <Fragment key={row.studentId}>
                  <TableRow
                    className={row.billed ? 'opacity-40' : 'cursor-pointer hover:bg-muted/50'}
                    onClick={() => toggle(row.studentId)}
                  >
                    <TableCell className="text-muted-foreground text-xs select-none">
                      {isOpen ? '▼' : '▶'}
                    </TableCell>
                    <TableCell className="font-medium">
                      <p>{row.studentName}</p>
                      {row.studentEnglishName && (
                        <p className="text-xs text-muted-foreground font-normal">{row.studentEnglishName}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.grade ?? '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.campus ?? '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.tutorName ?? '—'}</TableCell>
                    <TableCell>
                      {row.isSchoolStudent && <Badge variant="secondary">校內生</Badge>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[220px] truncate" title={row.courseNames.join('、')}>
                      {row.courseNames.join('、')}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {row.leaveDays > 0 ? row.leaveDays : '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      ${row.total.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center">
                      {row.billed ? (
                        <div className="flex flex-col items-center gap-1">
                          <Badge variant="secondary">已開帳</Badge>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRebill(row.studentId); }}
                            disabled={rebilling.has(row.studentId)}
                            className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 disabled:opacity-40"
                          >
                            {rebilling.has(row.studentId) ? '處理中…' : '重新開帳'}
                          </button>
                        </div>
                      ) : (
                        <Badge variant="outline">待開帳</Badge>
                      )}
                    </TableCell>
                  </TableRow>

                  {isOpen && (
                    <TableRow key={`${row.studentId}-detail`} className={row.billed ? 'opacity-40' : ''}>
                      <TableCell colSpan={10} className="bg-muted/30 pb-3 pt-0">
                        <div className="ml-8 mt-2 text-sm space-y-0.5">
                          {positives.map((item, i) => (
                            <div key={i} className="flex justify-between py-0.5">
                              <span>{item.name}</span>
                              <span className="font-mono">${item.amount.toLocaleString()}</span>
                            </div>
                          ))}
                          {negatives.map((item, i) => (
                            <div key={i} className="flex justify-between py-0.5 text-green-700">
                              <span>{item.name}</span>
                              <span className="font-mono">−${Math.abs(item.amount).toLocaleString()}</span>
                            </div>
                          ))}
                          <div className="flex justify-between pt-1.5 mt-1 border-t font-semibold">
                            <span>應收合計</span>
                            <span className="font-mono">${row.total.toLocaleString()}</span>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {result && (
        <p className="text-sm text-muted-foreground">
          已生成 {result.created} 筆，跳過 {result.skipped} 筆（已有帳單）。
        </p>
      )}

      {newCount > 0 && (
        <Button size="lg" disabled={pending} onClick={handleGenerate}>
          {pending ? '生成中...' : `生成 ${newCount} 筆帳單（截止日 ${billingMonth}-25）`}
        </Button>
      )}
      {newCount === 0 && !result && (
        <p className="text-sm text-muted-foreground">本月所有學生已開帳。</p>
      )}
    </div>
  );
}
