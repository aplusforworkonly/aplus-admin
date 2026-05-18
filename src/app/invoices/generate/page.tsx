import { createServerClient } from '@/lib/supabase/server';
import { TuitionCalculator } from '@/lib/finance/tuition-calculator';
import { getGrade } from '@/lib/grade';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import BillingPreviewTable from '@/components/invoices/BillingPreviewTable';
import type { BillingRow } from '@/components/invoices/BillingPreviewTable';
import Link from 'next/link';

const CAMPUSES = ['文府總校', '龍華校', '左新校'];
const GRADE_ORDER = ['大班升小一', '小一', '小二', '小三', '小四', '小五', '小六'];

function filterHref(billingMonth: string, campus: string, grade: string) {
  const p = new URLSearchParams({ month: billingMonth });
  if (campus) p.set('campus', campus);
  if (grade) p.set('grade', grade);
  return `/invoices/generate?${p.toString()}`;
}

const pillCls = (active: boolean) =>
  `text-xs px-3 py-1.5 rounded-md border transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'border-input hover:bg-muted'}`;

const MONTHS = ['2026-07', '2026-08'];

export default async function GenerateInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; done?: string; campus?: string; grade?: string }>;
}) {
  const { month, done, campus, grade } = await searchParams;
  const billingMonth = MONTHS.includes(month ?? '') ? month! : null;

  if (!billingMonth) {
    return (
      <div className="p-6 max-w-lg space-y-6">
        <h1 className="text-2xl font-bold">月底批次計費</h1>
        <p className="text-muted-foreground text-sm">選擇要開立帳單的月份：</p>
        <div className="flex gap-3">
          {MONTHS.map((m) => (
            <Link
              key={m}
              href={`/invoices/generate?month=${m}`}
              className="inline-flex items-center justify-center h-12 rounded-lg border px-6 text-sm font-medium hover:bg-accent transition-colors"
            >
              {m.replace('-', ' 年 ')} 月
            </Link>
          ))}
        </div>
      </div>
    );
  }

  // Load data for preview
  const supabase = createServerClient();
  const [year, mon] = billingMonth.split('-').map(Number);
  const startDate = `${billingMonth}-01`;
  const endDate = new Date(year, mon, 1).toISOString().split('T')[0];

  const [{ data: enrollments }, { data: students }, { data: leaves }, { data: existing }, { data: allInvoices }] =
    await Promise.all([
      supabase
        .from('enrollments')
        .select('id, student_id, courses(name, course_type, base_price)')
        .eq('status', '生效')
        .gte('start_date', startDate)
        .lt('start_date', endDate),
      supabase
        .from('students')
        .select('id, name, english_name, is_school_student, campus, enrollment_date, main_tutor_id')
        .order('name'),
      supabase
        .from('student_leaves')
        .select('student_id, leave_date')
        .gte('leave_date', startDate)
        .lt('leave_date', endDate),
      supabase
        .from('invoices')
        .select('student_id')
        .eq('billing_month', billingMonth),
      supabase
        .from('invoices')
        .select('id, student_id'),
    ]);

  const alreadyBilled = new Set((existing ?? []).map((i) => i.student_id));
  const filteredEnrollments = (enrollments ?? []).filter((e) => (e.courses as any)?.course_type !== 'afternoon_basic');
  const enrolledIds = new Set(filteredEnrollments.map((e) => e.student_id));
  const eligibleStudents = (students ?? []).filter((s) => enrolledIds.has(s.id));

  const tutorIds = [...new Set(eligibleStudents.map((s: any) => s.main_tutor_id).filter(Boolean))];
  let tutorNames: Record<string, string> = {};
  if (tutorIds.length > 0) {
    const { data: tutorRows } = await supabase.from('teachers').select('id, english_name').in('id', tutorIds);
    for (const t of tutorRows ?? []) tutorNames[(t as any).id] = (t as any).english_name ?? '';
  }

  let filtered = eligibleStudents;
  if (campus) filtered = filtered.filter((s: any) => s.campus === campus);
  if (grade) filtered = filtered.filter((s: any) => {
    const d = (s as any).enrollment_date;
    return d ? getGrade(d) === grade : false;
  });

  // Find students already charged YLE教材費 in any prior invoice
  const allInvoiceIds = (allInvoices ?? []).map((i) => i.id);
  const ylaChargedStudents = new Set<string>();
  if (allInvoiceIds.length > 0) {
    const { data: ylaItems } = await supabase
      .from('invoice_line_items')
      .select('invoice_id')
      .eq('item_name', 'YLE教材費')
      .in('invoice_id', allInvoiceIds);
    const chargedInvoiceIds = new Set((ylaItems ?? []).map((i) => i.invoice_id));
    (allInvoices ?? [])
      .filter((i) => chargedInvoiceIds.has(i.id))
      .forEach((i) => ylaChargedStudents.add(i.student_id));
  }

  const rows: BillingRow[] = filtered.map((student) => {
    const stuEnrollments = filteredEnrollments
      .filter((e) => e.student_id === student.id)
      .map((e) => {
        const c = e.courses as any;
        return { courseName: c.name, courseType: c.course_type, basePrice: c.base_price, actualFee: c.base_price };
      });
    const leaveDates = (leaves ?? [])
      .filter((l) => l.student_id === student.id)
      .map((l) => l.leave_date);
    const items = new TuitionCalculator({
      enrollments: stuEnrollments,
      leaveDates,
      halfDayConfig: {},
      attendance: {},
      isSchoolStudent: student.is_school_student,
      chargedMaterialFees: ylaChargedStudents.has(student.id) ? ['YLE教材費'] : [],
    } as any).calculate();
    const total = items.reduce((s: number, i: any) => s + i.amount, 0);
    return {
      studentId: student.id,
      studentName: student.name,
      studentEnglishName: (student as any).english_name ?? undefined,
      isSchoolStudent: student.is_school_student,
      campus: (student as any).campus ?? undefined,
      grade: (student as any).enrollment_date ? getGrade((student as any).enrollment_date) : undefined,
      tutorName: (student as any).main_tutor_id ? tutorNames[(student as any).main_tutor_id] : undefined,
      courseNames: stuEnrollments.map((e) => e.courseName),
      leaveDays: leaveDates.length,
      items,
      total,
      billed: alreadyBilled.has(student.id),
    };
  });

  const newCount = rows.filter((r) => !r.billed).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <div>
          <Link href="/invoices/generate" className="text-sm text-muted-foreground hover:underline">
            ← 重選月份
          </Link>
          <h1 className="text-2xl font-bold mt-1">
            {billingMonth.replace('-', ' 年 ')} 月 — 批次計費預覽
          </h1>
        </div>
        {done && (
          <Badge className="ml-auto">已生成 {done} 筆帳單</Badge>
        )}
      </div>

      {/* 篩選列 */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-muted-foreground w-10">校區</span>
          <Link href={filterHref(billingMonth, '', grade ?? '')} className={pillCls(!campus)}>全部</Link>
          {CAMPUSES.map((c) => (
            <Link key={c} href={filterHref(billingMonth, c, grade ?? '')} className={pillCls(campus === c)}>{c}</Link>
          ))}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-muted-foreground w-10">年級</span>
          <Link href={filterHref(billingMonth, campus ?? '', '')} className={pillCls(!grade)}>全部</Link>
          {GRADE_ORDER.map((g) => (
            <Link key={g} href={filterHref(billingMonth, campus ?? '', g)} className={pillCls(grade === g)}>{g}</Link>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            共 {rows.length} 位學生有效報名，{newCount} 位待開帳
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <BillingPreviewTable billingMonth={billingMonth} rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
