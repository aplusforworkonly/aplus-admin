import { notFound } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { updateInvoiceStatus } from '@/actions/invoices';
import type { InvoiceStatus } from '@/lib/supabase/types';
import Link from 'next/link';

const STATUS_VARIANT: Record<InvoiceStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  已結清: 'default',
  部分繳清: 'outline',
  未繳: 'destructive',
};

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createServerClient();

  const [{ data: invoice, error }, { data: items }] = await Promise.all([
    supabase
      .from('invoices')
      .select('*, students(name, english_name)')
      .eq('id', id)
      .single(),
    supabase
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', id)
      .order('created_at'),
  ]);

  if (error || !invoice) notFound();

  const studentName = (invoice.students as any)?.name ?? '—';
  const studentEnglishName = (invoice.students as any)?.english_name ?? null;
  const totalAmount = Number(invoice.total_amount);
  const paidAmount = Number(invoice.paid_amount);
  const balance = totalAmount - paidAmount;

  const positiveItems = (items ?? []).filter((i) => Number(i.amount) > 0);
  const negativeItems = (items ?? []).filter((i) => Number(i.amount) < 0);

  async function markPaid() {
    'use server';
    await updateInvoiceStatus(id, '已結清');
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <Link href="/invoices" className="text-sm text-muted-foreground hover:text-foreground">
        ← 帳單管理
      </Link>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{invoice.invoice_no}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {studentName}{studentEnglishName ? ` (${studentEnglishName})` : ''}・{invoice.billing_month}
          </p>
        </div>
        <Badge variant={STATUS_VARIANT[invoice.status as InvoiceStatus] ?? 'secondary'} className="text-sm">
          {invoice.status}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">帳單明細</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>項目</TableHead>
                <TableHead>類型</TableHead>
                <TableHead className="w-28 text-right">金額</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positiveItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-sm">{item.item_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.item_type}</TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    ${Number(item.amount).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
              {negativeItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-sm text-muted-foreground">{item.item_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.item_type}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-green-600">
                    −${Math.abs(Number(item.amount)).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
              {(items ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                    尚無明細項目
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span>應繳金額</span>
            <span className="font-mono">${totalAmount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>已繳金額</span>
            <span className="font-mono text-green-600">${paidAmount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm font-semibold border-t pt-2">
            <span>待繳餘額</span>
            <span className="font-mono">${balance.toLocaleString()}</span>
          </div>
          <p className="text-xs text-muted-foreground">截止日期：{invoice.due_date}</p>
        </CardContent>
      </Card>

      {invoice.status !== '已結清' && (
        <form action={markPaid}>
          <Button type="submit">標記為已結清</Button>
        </form>
      )}
    </div>
  );
}
