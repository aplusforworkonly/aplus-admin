import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import type { InvoiceStatus } from '@/lib/supabase/types';
import { getGrade } from '@/lib/grade';
import InvoiceFilterBar from '@/components/invoices/InvoiceFilterBar';
import RebillButton from '@/components/invoices/RebillButton';
import CancelInvoiceButton from '@/components/invoices/CancelInvoiceButton';
import { AlertTriangle } from 'lucide-react';
import { CAMPUSES } from '@/lib/constants';

const STATUS_VARIANT: Record<InvoiceStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  已結清: 'default',
  部分繳清: 'outline',
  未繳: 'destructive',
};

const GRADE_ORDER = ['大班升小一', '小一', '小二', '小三', '小四', '小五', '小六'];

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; campus?: string; grade?: string; tutorId?: string }>;
}) {
  const { status, campus, grade, tutorId } = await searchParams;
  const supabase = createServerClient();

  const [invoicesResult, teachersResult] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, invoice_no, billing_month, total_amount, paid_amount, status, due_date, student_id, enrollment_ids, students(id, name, english_name, campus, enrollment_date, main_tutor_id)')
      .order('due_date', { ascending: false })
      .then((r) => {
        if (r.error) throw new Error(r.error.message);
        let data = r.data ?? [];
        if (status && status !== 'all') data = data.filter((i) => i.status === status);
        if (campus) data = data.filter((i) => (i.students as any)?.campus === campus);
        if (grade) data = data.filter((i) => {
          const d = (i.students as any)?.enrollment_date;
          return d ? getGrade(d) === grade : false;
        });
        if (tutorId) data = data.filter((i) => (i.students as any)?.main_tutor_id === tutorId);
        return data;
      }),
    supabase.from('teachers').select('id, name').order('name'),
  ]);

  const invoices = Array.isArray(invoicesResult) ? invoicesResult : [];
  const teachers = (teachersResult.data ?? []) as { id: string; name: string }[];

  // ── Stale detection ──────────────────────────────────────────────────────
  const allBilledIds = [...new Set(invoices.flatMap((inv: any) => inv.enrollment_ids ?? []))];
  let billedStatusMap: Record<string, string> = {};
  if (allBilledIds.length > 0) {
    const { data } = await supabase.from('enrollments').select('id, status').in('id', allBilledIds);
    for (const e of data ?? []) billedStatusMap[(e as any).id] = (e as any).status;
  }

  const monthGroups: Record<string, { studentId: string; billedIds: string[]; invoiceId: string }[]> = {};
  for (const inv of invoices as any[]) {
    if (!(inv.enrollment_ids as string[] | null)?.length) continue;
    if (!monthGroups[inv.billing_month]) monthGroups[inv.billing_month] = [];
    monthGroups[inv.billing_month].push({ studentId: inv.student_id, invoiceId: inv.id, billedIds: inv.enrollment_ids });
  }
  const currentEnrollMap: Record<string, Set<string>> = {};
  for (const [billingMonth, entries] of Object.entries(monthGroups)) {
    const [year, mon] = billingMonth.split('-').map(Number);
    const startDate = `${billingMonth}-01`;
    const endDate = new Date(year, mon, 1).toISOString().split('T')[0];
    const { data } = await supabase.from('enrollments')
      .select('id, student_id').eq('status', '生效')
      .gte('start_date', startDate).lt('start_date', endDate)
      .in('student_id', entries.map((e) => e.studentId));
    for (const e of data ?? []) {
      const key = `${(e as any).student_id}_${billingMonth}`;
      if (!currentEnrollMap[key]) currentEnrollMap[key] = new Set();
      currentEnrollMap[key].add((e as any).id);
    }
  }

  const staleInvoiceIds = new Set<string>();
  for (const inv of invoices as any[]) {
    const billedIds: string[] = inv.enrollment_ids ?? [];
    if (!billedIds.length) continue;
    const hasCancelled = billedIds.some((eid) => billedStatusMap[eid] && billedStatusMap[eid] !== '生效');
    const currentIds = currentEnrollMap[`${inv.student_id}_${inv.billing_month}`] ?? new Set();
    const billedSet = new Set(billedIds);
    const hasNew = [...currentIds].some((eid) => !billedSet.has(eid));
    if (hasCancelled || hasNew) staleInvoiceIds.add(inv.id);
  }
  // ─────────────────────────────────────────────────────────────────────────

  const statuses: Array<{ value: string; label: string }> = [
    { value: 'all', label: '全部' },
    { value: '未繳', label: '未繳' },
    { value: '部分繳清', label: '部分繳清' },
    { value: '已結清', label: '已結清' },
  ];

  const currentFilters = {
    status: status ?? 'all',
    campus: campus ?? '',
    grade: grade ?? '',
    tutorId: tutorId ?? '',
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">帳單管理</h1>
        <div className="flex gap-2">
          <Link
            href="/invoices/rules"
            className="inline-flex items-center justify-center h-9 rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent transition-colors"
          >
            折扣規則
          </Link>
          <Link
            href="/invoices/generate"
            className="inline-flex items-center justify-center h-9 rounded-md border border-primary bg-primary text-primary-foreground px-4 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            月底計費
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex gap-1">
          {statuses.map((s) => (
            <Link
              key={s.value}
              href={(() => {
                const p = new URLSearchParams();
                if (s.value !== 'all') p.set('status', s.value);
                if (campus) p.set('campus', campus);
                if (grade) p.set('grade', grade);
                if (tutorId) p.set('tutorId', tutorId);
                return `/invoices${p.size > 0 ? '?' + p.toString() : ''}`;
              })()}
              className={[
                'inline-flex items-center justify-center h-8 rounded-md border px-3 text-xs font-medium transition-colors',
                (status ?? 'all') === s.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-background hover:bg-accent',
              ].join(' ')}
            >
              {s.label}
            </Link>
          ))}
        </div>
        <InvoiceFilterBar
          campuses={CAMPUSES}
          grades={GRADE_ORDER}
          tutors={teachers}
          current={currentFilters}
        />
        <span className="text-sm text-muted-foreground ml-auto">
          {invoices.length} 筆
        </span>
      </div>

      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-36">帳單編號</TableHead>
            <TableHead>學生</TableHead>
            <TableHead className="w-24">帳單月份</TableHead>
            <TableHead className="w-28 text-right">應繳金額</TableHead>
            <TableHead className="w-28 text-right">已繳金額</TableHead>
            <TableHead className="w-24">截止日</TableHead>
            <TableHead className="w-20">狀態</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                沒有帳單資料
              </TableCell>
            </TableRow>
          )}
          {invoices.map((inv) => (
            <TableRow key={inv.id}>
              <TableCell className="font-mono text-xs">{inv.invoice_no}</TableCell>
              <TableCell className="font-medium text-sm">
                <p>{(inv.students as any)?.name ?? '—'}</p>
                {(inv.students as any)?.english_name && (
                  <p className="text-xs text-muted-foreground font-normal">{(inv.students as any).english_name}</p>
                )}
              </TableCell>
              <TableCell className="text-sm">{inv.billing_month}</TableCell>
              <TableCell className="text-right font-mono text-sm">
                ${Number(inv.total_amount).toLocaleString()}
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                ${Number(inv.paid_amount).toLocaleString()}
              </TableCell>
              <TableCell className="text-sm">{inv.due_date}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  {staleInvoiceIds.has(inv.id) && (
                    <span title="報名內容已變更，建議重新開帳">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    </span>
                  )}
                  <Badge variant={STATUS_VARIANT[inv.status as InvoiceStatus] ?? 'secondary'}>
                    {inv.status}
                  </Badge>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/invoices/${inv.id}`}
                    className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                  >
                    明細
                  </Link>
                  <RebillButton
                    studentId={(inv.students as any)?.id ?? ''}
                    billingMonth={inv.billing_month}
                  />
                  <CancelInvoiceButton invoiceId={inv.id} invoiceNo={inv.invoice_no} />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
