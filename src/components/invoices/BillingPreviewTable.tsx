'use client';
import { Fragment, useState, useTransition } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { generateMonthlyInvoices } from '@/actions/invoices';
import { useRouter } from 'next/navigation';

export type BillingRow = {
  studentId: string;
  studentName: string;
  isSchoolStudent: boolean;
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
  const router = useRouter();

  const newCount = rows.filter((r) => !r.billed).length;

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
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>學生</TableHead>
              <TableHead className="w-20">校內生</TableHead>
              <TableHead>課程</TableHead>
              <TableHead className="w-16 text-center">請假天</TableHead>
              <TableHead className="w-28 text-right">應收金額</TableHead>
              <TableHead className="w-20 text-center">狀態</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
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
                    <TableCell className="font-medium">{row.studentName}</TableCell>
                    <TableCell>
                      {row.isSchoolStudent && <Badge variant="secondary">校內生</Badge>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.courseNames.join('、')}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {row.leaveDays > 0 ? row.leaveDays : '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      ${row.total.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center">
                      {row.billed
                        ? <Badge variant="secondary">已開帳</Badge>
                        : <Badge variant="outline">待開帳</Badge>}
                    </TableCell>
                  </TableRow>

                  {isOpen && (
                    <TableRow key={`${row.studentId}-detail`} className={row.billed ? 'opacity-40' : ''}>
                      <TableCell colSpan={7} className="bg-muted/30 pb-3 pt-0">
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
