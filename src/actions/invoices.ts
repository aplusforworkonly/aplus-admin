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

export async function cancelInvoice(invoiceId: string) {
  const supabase = createServerClient();
  await supabase.from('invoice_line_items').delete().eq('invoice_id', invoiceId);
  const { error } = await supabase.from('invoices').delete().eq('id', invoiceId);
  if (error) throw new Error(error.message);
  revalidatePath('/invoices');
}

export async function rebillStudent(studentId: string, billingMonth: string) {
  const supabase = createServerClient();

  const [year, month] = billingMonth.split('-').map(Number);
  const startDate = `${billingMonth}-01`;
  const endDate = new Date(year, month, 1).toISOString().split('T')[0];
  const dueDate = `${billingMonth}-25`;

  // Delete existing invoice for this student+month
  const { data: existing } = await supabase
    .from('invoices')
    .select('id')
    .eq('student_id', studentId)
    .eq('billing_month', billingMonth);
  for (const inv of existing ?? []) {
    await supabase.from('invoice_line_items').delete().eq('invoice_id', inv.id);
    await supabase.from('invoices').delete().eq('id', inv.id);
  }

  // Fetch current enrollments
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('id, student_id, start_date, courses(name, course_type, billing_cycle, base_price)')
    .eq('student_id', studentId)
    .eq('status', '生效')
    .lt('start_date', endDate)
    .or(`end_date.is.null,end_date.gte.${startDate}`);

  const { data: student } = await supabase
    .from('students')
    .select('id, name, is_school_student, july_half_day, august_half_day, half_day_am_dates, half_day_pm_dates, half_day_meal_dates')
    .eq('id', studentId)
    .single();
  if (!student) throw new Error('找不到學生');

  const { data: leaves } = await supabase
    .from('student_leaves')
    .select('leave_date')
    .eq('student_id', studentId)
    .gte('leave_date', startDate)
    .lt('leave_date', endDate);

  // YLE dedup: check invoices OTHER than the ones just deleted
  const { data: otherInvoices } = await supabase
    .from('invoices')
    .select('id')
    .eq('student_id', studentId);
  const otherIds = (otherInvoices ?? []).map((i) => i.id);
  let ylaCharged = false;
  if (otherIds.length > 0) {
    const { data: ylaItems } = await supabase
      .from('invoice_line_items')
      .select('id')
      .eq('item_name', 'YLE教材費')
      .in('invoice_id', otherIds);
    ylaCharged = (ylaItems ?? []).length > 0;
  }

  // Pending charges
  const { data: pendingCharges } = await supabase
    .from('student_charges')
    .select('id, amount, item_details')
    .eq('student_id', studentId)
    .eq('status', 'pending_billing');

  const billingEnrollments = (enrollments ?? []).filter((e: any) => {
    const c = e.courses;
    if (!c) return false;
    if (c.billing_cycle === 'monthly' && c.course_type === 'camp') return true;
    return e.start_date >= startDate;
  });
  const studentEnrollments = billingEnrollments.map((e: any) => ({
    courseName: e.courses.name,
    courseType: e.courses.course_type,
    basePrice: e.courses.base_price,
    actualFee: e.courses.base_price,
  }));

  const halfDayConfig = {
    julyFullHalf:      (student as any).july_half_day === 'full_month',
    julyFullHalfMeal:  (student as any).july_half_day === 'full_month_meal',
    augustFullHalf:    (student as any).august_half_day === 'full_month',
    augustFullHalfMeal: (student as any).august_half_day === 'full_month_meal',
    halfDayDates:      Array.from(new Set([...((student as any).half_day_am_dates ?? []), ...((student as any).half_day_pm_dates ?? [])])),
    halfDayMealDates:  (student as any).half_day_meal_dates ?? [],
  };
  const calc = new TuitionCalculator({
    enrollments: studentEnrollments,
    leaveDates: (leaves ?? []).map((l: any) => l.leave_date),
    halfDayConfig,
    attendance: {},
    isSchoolStudent: student.is_school_student,
    chargedMaterialFees: ylaCharged ? ['YLE教材費'] : [],
  } as any);
  const items = calc.calculate();
  let totalAmount = items.reduce((s: number, i: any) => s + i.amount, 0);
  totalAmount += (pendingCharges ?? []).reduce((s: number, c: any) => s + c.amount, 0);

  const { data: invoiceNo } = await supabase.rpc('generate_invoice_no');
  const { data: invoice, error: invErr } = await supabase
    .from('invoices')
    .insert({
      invoice_no: invoiceNo,
      student_id: studentId,
      billing_month: billingMonth,
      total_amount: totalAmount,
      paid_amount: 0,
      status: '未繳',
      due_date: dueDate,
      enrollment_ids: billingEnrollments.map((e: any) => e.id),
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

  for (const charge of pendingCharges ?? []) {
    let itemName = '物品購買';
    try {
      const details = typeof charge.item_details === 'string'
        ? JSON.parse(charge.item_details)
        : charge.item_details;
      if (details.item && details.qty) itemName = `${details.item} x${details.qty}`;
    } catch (e) {}
    lineItems.push({ invoice_id: invoice.id, item_name: itemName, item_type: '附加費', amount: charge.amount, remark: null });
  }

  if (lineItems.length > 0) {
    const { error: liErr } = await supabase.from('invoice_line_items').insert(lineItems);
    if (liErr) throw new Error(liErr.message);
  }

  if ((pendingCharges ?? []).length > 0) {
    await supabase
      .from('student_charges')
      .update({ status: 'billed', updated_at: new Date().toISOString() })
      .in('id', (pendingCharges ?? []).map((c: any) => c.id));
  }

  revalidatePath('/invoices');
  revalidatePath('/invoices/generate');
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
    .select('student_id, course_id, campus, status, start_date, courses(name, course_type, billing_cycle, base_price)')
    .eq('status', '生效')
    .lt('start_date', endDate)
    .or(`end_date.is.null,end_date.gte.${startDate}`);
  if (enErr) throw new Error(enErr.message);
  const billingEnrollments = (enrollments ?? []).filter((e) => {
    const course = e.courses as any;
    if (course?.course_type === 'afternoon_basic') return false;
    if (course?.billing_cycle === 'monthly' && course?.course_type === 'camp') return true;
    return (e as any).start_date >= startDate;
  });
  if (!billingEnrollments.length) return { created: 0, skipped: 0 };

  // Load student info
  const studentIds = [...new Set(billingEnrollments.map((e) => e.student_id))];
  const { data: students, error: stErr } = await supabase
    .from('students')
    .select('id, name, is_school_student, july_half_day, august_half_day, half_day_am_dates, half_day_pm_dates, half_day_meal_dates')
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

  // Load pending charges
  const { data: pendingCharges } = await supabase
    .from('student_charges')
    .select('id, student_id, amount, item_details')
    .eq('status', 'pending_billing')
    .in('student_id', studentIds);

  let created = 0;
  let skipped = 0;

  for (const student of students ?? []) {
    if (alreadyBilled.has(student.id)) { skipped++; continue; }

    const studentEnrollments = billingEnrollments
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

    const studentPendingCharges = (pendingCharges ?? []).filter((c) => c.student_id === student.id);

    if (!studentEnrollments.length && !studentPendingCharges.length) continue;

    const leaveDates = (leaves ?? [])
      .filter((l) => l.student_id === student.id)
      .map((l) => l.leave_date);

    const halfDayConfig = {
      julyFullHalf:      (student as any).july_half_day === 'full_month',
      julyFullHalfMeal:  (student as any).july_half_day === 'full_month_meal',
      augustFullHalf:    (student as any).august_half_day === 'full_month',
      augustFullHalfMeal: (student as any).august_half_day === 'full_month_meal',
      halfDayDates:      Array.from(new Set([...((student as any).half_day_am_dates ?? []), ...((student as any).half_day_pm_dates ?? [])])),
      halfDayMealDates:  (student as any).half_day_meal_dates ?? [],
    };
    const calc = new TuitionCalculator({
      enrollments: studentEnrollments,
      leaveDates,
      halfDayConfig,
      attendance: {},
      isSchoolStudent: student.is_school_student,
      chargedMaterialFees: ylaChargedStudents.has(student.id) ? ['YLE教材費'] : [],
    } as any);
    const items = calc.calculate();
    let totalAmount = items.reduce((sum: number, i: any) => sum + i.amount, 0);
    totalAmount += studentPendingCharges.reduce((sum: number, c: any) => sum + c.amount, 0);

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
        enrollment_ids: billingEnrollments
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

    for (const charge of studentPendingCharges) {
      let itemName = '物品購買';
      try {
        const details = typeof charge.item_details === 'string' 
          ? JSON.parse(charge.item_details) 
          : charge.item_details;
        if (details.item && details.qty) {
          itemName = `${details.item} x${details.qty}`;
        }
      } catch(e) {}

      lineItems.push({
        invoice_id: invoice.id,
        item_name: itemName,
        item_type: '附加費',
        amount: charge.amount,
        remark: null,
      });
    }

    if (lineItems.length > 0) {
      const { error: liErr } = await supabase.from('invoice_line_items').insert(lineItems);
      if (liErr) throw new Error(liErr.message);
    }

    if (studentPendingCharges.length > 0) {
      const chargeIds = studentPendingCharges.map((c) => c.id);
      await supabase
        .from('student_charges')
        .update({ status: 'billed', updated_at: new Date().toISOString() })
        .in('id', chargeIds);
    }

    created++;
  }

  revalidatePath('/invoices');
  return { created, skipped };
}
