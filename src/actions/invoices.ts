'use server';
import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { TuitionCalculator } from '@/lib/finance/tuition-calculator';
import type { InvoiceStatus } from '@/lib/supabase/types';

export async function updateInvoiceStatus(id: string, status: InvoiceStatus) {
  const supabase = createServerClient();
  const { error } = await supabase.from('invoices').update({ status }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/invoices');
  revalidatePath(`/invoices/${id}`);
}

export async function generateMonthlyInvoices(billingMonth: string) {
  const supabase = createServerClient();

  const [year, month] = billingMonth.split('-').map(Number);
  const startDate = `${billingMonth}-01`;
  const endDate = new Date(year, month, 1).toISOString().split('T')[0];
  const dueDate = `${billingMonth}-25`;

  // Load active enrollments for the month
  const { data: enrollments, error: enErr } = await supabase
    .from('enrollments')
    .select('student_id, course_id, campus, status, courses(name, course_type, base_price)')
    .eq('status', '生效')
    .gte('start_date', startDate)
    .lt('start_date', endDate);
  if (enErr) throw new Error(enErr.message);
  if (!enrollments?.length) return { created: 0, skipped: 0 };

  // Load student info
  const studentIds = [...new Set(enrollments.map((e) => e.student_id))];
  const { data: students, error: stErr } = await supabase
    .from('students')
    .select('id, name, is_school_student')
    .in('id', studentIds);
  if (stErr) throw new Error(stErr.message);

  // Load leaves for the month
  const { data: leaves } = await supabase
    .from('student_leaves')
    .select('student_id, leave_date')
    .gte('leave_date', startDate)
    .lt('leave_date', endDate);

  // Check existing invoices to skip duplicates
  const { data: existing } = await supabase
    .from('invoices')
    .select('student_id')
    .eq('billing_month', billingMonth)
    .in('student_id', studentIds);
  const alreadyBilled = new Set((existing ?? []).map((i) => i.student_id));

  // Find students already charged YLE教材費 in any prior invoice (to avoid double-charging across months)
  const { data: allInvoices } = await supabase
    .from('invoices')
    .select('id, student_id')
    .in('student_id', studentIds);
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

  let created = 0;
  let skipped = 0;

  for (const student of students ?? []) {
    if (alreadyBilled.has(student.id)) { skipped++; continue; }

    const studentEnrollments = enrollments
      .filter((e) => e.student_id === student.id)
      .map((e) => {
        const course = e.courses as any;
        return {
          courseName: course.name,
          courseType: course.course_type,
          basePrice: course.base_price,
          actualFee: course.base_price,
        };
      });

    if (!studentEnrollments.length) continue;

    const leaveDates = (leaves ?? [])
      .filter((l) => l.student_id === student.id)
      .map((l) => l.leave_date);

    const calc = new TuitionCalculator({
      enrollments: studentEnrollments,
      leaveDates,
      halfDayConfig: {},
      attendance: {},
      isSchoolStudent: student.is_school_student,
      chargedMaterialFees: ylaChargedStudents.has(student.id) ? ['YLE教材費'] : [],
    });
    const items = calc.calculate();
    const totalAmount = items.reduce((sum: number, i: any) => sum + i.amount, 0);

    // Generate invoice_no via RPC
    const { data: invoiceNo } = await supabase.rpc('generate_invoice_no');

    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .insert({
        invoice_no: invoiceNo,
        student_id: student.id,
        billing_month: billingMonth,
        total_amount: totalAmount,
        paid_amount: 0,
        status: '未繳',
        due_date: dueDate,
        enrollment_ids: enrollments
          .filter((e) => e.student_id === student.id)
          .map((e: any) => e.id),
      })
      .select('id')
      .single();
    if (invErr) throw new Error(invErr.message);

    const lineItems = items.map((item: any) => ({
      invoice_id: invoice.id,
      item_name: item.name,
      item_type: item.amount > 0 ? '常規學費' : '單次折抵',
      amount: item.amount,
      remark: null,
    }));

    const { error: liErr } = await supabase.from('invoice_line_items').insert(lineItems);
    if (liErr) throw new Error(liErr.message);
    created++;
  }

  revalidatePath('/invoices');
  return { created, skipped };
}
