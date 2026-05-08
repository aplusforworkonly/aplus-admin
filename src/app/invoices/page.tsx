import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import type { InvoiceStatus } from '@/lib/supabase/types';

const STATUS_VARIANT: Record<InvoiceStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  已結清: 'default',
  部分繳清: 'outline',
  未繳: 'destructive',
};

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const supabase = createServerClient();

  let query = supabase
    .from('invoices')
    .select('id, invoice_no, billing_month, total_amount, paid_amount, status, due_date, students(name, english_name)')
    .order('due_date', { ascending: false });

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const { data: invoices, error } = await query;
  if (error) throw new Error(error.message);

  const statuses: Array<{ value: string; label: string }> = [
    { value: 'all', label: '全部' },
    { value: '未繳', label: '未繳' },
    { value: '部分繳清', label: '部分繳清' },
    { value: '已結清', label: '已結清' },
  ];

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

      <div className="flex gap-1 mb-4">
        {statuses.map((s) => (
          <Link
            key={s.value}
            href={s.value === 'all' ? '/invoices' : `/invoices?status=${encodeURIComponent(s.value)}`}
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
        <span className="text-sm text-muted-foreground ml-auto self-center">
          {invoices?.length ?? 0} 筆
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
          {(invoices ?? []).length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                沒有帳單資料
              </TableCell>
            </TableRow>
          )}
          {(invoices ?? []).map((inv) => (
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
                <Badge variant={STATUS_VARIANT[inv.status as InvoiceStatus] ?? 'secondary'}>
                  {inv.status}
                </Badge>
              </TableCell>
              <TableCell>
                <Link
                  href={`/invoices/${inv.id}`}
                  className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                >
                  明細
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
