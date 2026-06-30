'use server';
import { createServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { createAdminTask, resolveTaskBySourceId } from '@/actions/admin-tasks';
import { rebillStudent } from '@/actions/invoices';
import { getHandledBy } from '@/actions/shared';

function normalizeDate(d: string): string {
  const m = d.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return d;
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
}

function mergeAndSort(existing: string[], incoming: string[]): string[] {
  return Array.from(new Set([...existing, ...incoming.map(normalizeDate)])).sort();
}


export type StudentEnrollment = {
  enrollmentId: string;
  courseId: string;
  courseName: string;
  startDate: string | null;
};

export async function getStudentEnrollments(studentId: string): Promise<StudentEnrollment[]> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('enrollments')
    .select('id, course_id, start_date, courses(name, course_type)')
    .eq('student_id', studentId)
    .eq('status', '生效');
  return (data ?? [])
    .filter((e: any) => e.courses?.course_type !== 'material' && e.courses?.course_type !== 'afternoon_basic')
    .map((e: any) => ({
      enrollmentId: e.id,
      courseId: e.course_id,
      courseName: e.courses?.name ?? '—',
      startDate: e.start_date ?? null,
    }));
}

export async function submitCancelRequest(data: {
  teacherId: string;
  studentId: string;
  courseId?: string | null;
  enrollmentId?: string | null;
  startDate?: string | null;
  reason: string;
  requestType: 'cancel' | 'add' | 'purchase' | 'departure' | 'half_day' | 'meal';
}) {
  const supabase = createServerClient();
  const requestTypeLabels: Record<string, string> = {
    cancel: '取消課程',
    add: '加報課程',
    purchase: '物品購買',
    departure: '離校通知',
    half_day: '半日異動',
    meal: '新增餐點',
  };

  const { data: inserted, error } = await supabase.from('student_requests').insert({
    teacher_id: data.teacherId,
    student_id: data.studentId,
    course_id: data.courseId || null,
    class_id: null,
    reason: data.reason,
    request_type: data.requestType,
    enrollment_id: data.enrollmentId || null,
    start_date: data.startDate || null,
  }).select('id').single();
  if (error) throw new Error(error.message);

  // 建立對應行政任務
  if (inserted?.id) {
    const { data: student } = await supabase
      .from('students').select('name, campus').eq('id', data.studentId).single();
    const label = requestTypeLabels[data.requestType] ?? data.requestType;
    await createAdminTask({
      title: `審核${label}：${student?.name ?? data.studentId}`,
      taskType: 'adhoc',
      taskSource: 'student_request',
      sourceId: inserted.id,
      campus: student?.campus ? [student.campus] : undefined,
      priority: data.requestType === 'departure' ? 'urgent' : 'normal',
      size: 'S',
    }).catch(() => {});
  }

  revalidatePath('/teacher');
}

export async function approveCancelRequest(id: string, isCashPaid?: boolean) {
  const supabase = createServerClient();
  const { data: req, error } = await supabase
    .from('student_requests')
    .select('student_id, course_id, request_type, reason, status, enrollment_id, start_date')
    .eq('id', id)
    .single();
  if (error || !req) throw new Error('找不到申請');

  if (req.request_type === 'cancel') {
    if ((req as any).enrollment_id) {
      // 精準取消指定的單筆合約
      await supabase
        .from('enrollments')
        .update({ status: '退班' })
        .eq('id', (req as any).enrollment_id);

      if (req.course_id) {
        const { data: linkedClasses } = await supabase
          .from('classes')
          .select('id')
          .eq('course_id', req.course_id);
        if (linkedClasses && linkedClasses.length > 0) {
          await supabase
            .from('class_students')
            .delete()
            .eq('student_id', req.student_id)
            .in('class_id', linkedClasses.map((c) => c.id));
        }
      }
    } else if (req.course_id) {
      // Fallback：舊紀錄，取消該學生該課程所有生效合約
      await supabase
        .from('enrollments')
        .update({ status: '退班' })
        .eq('student_id', req.student_id)
        .eq('course_id', req.course_id)
        .eq('status', '生效');

      const { data: linkedClasses } = await supabase
        .from('classes')
        .select('id')
        .eq('course_id', req.course_id);
      if (linkedClasses && linkedClasses.length > 0) {
        await supabase
          .from('class_students')
          .delete()
          .eq('student_id', req.student_id)
          .in('class_id', linkedClasses.map((c) => c.id));
      }
    }
  } else if (req.request_type === 'add') {
    if (req.course_id) {
      const [{ data: student }, { data: course }] = await Promise.all([
        supabase.from('students').select('campus').eq('id', req.student_id).single(),
        supabase.from('courses').select('max_capacity').eq('id', req.course_id).single(),
      ]);

      let newStatus: '生效' | '候補' = '生效';
      if (course?.max_capacity != null) {
        const { count } = await supabase
          .from('enrollments')
          .select('*', { count: 'exact', head: true })
          .eq('course_id', req.course_id)
          .eq('status', '生效');
        if ((count ?? 0) >= course.max_capacity) newStatus = '候補';
      }

      let enrollStart: string = (req as any).start_date ?? '';
      if (!enrollStart) {
        const { data: sample } = await supabase
          .from('enrollments')
          .select('start_date')
          .eq('course_id', req.course_id)
          .eq('status', '生效')
          .limit(1)
          .single();
        enrollStart = sample?.start_date
          ?? new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
      }
      await supabase.from('enrollments').insert({
        student_id: req.student_id,
        course_id: req.course_id,
        campus: student?.campus ?? '文府總校',
        start_date: enrollStart,
        status: newStatus,
        contract_no: `REQ-${Date.now()}`,
      });
    }
  } else if (req.request_type === 'departure') {
    let leaveDate = new Date().toISOString().split('T')[0];
    try {
      const parsed = JSON.parse(req.reason || '{}');
      if (parsed.date) leaveDate = parsed.date;
    } catch (e) {}

    await supabase.from('students').update({ status: '已離校' }).eq('id', req.student_id);

    const { data: activeEnrollments } = await supabase
      .from('enrollments')
      .select('id, notes')
      .eq('student_id', req.student_id)
      .eq('status', '生效');

    if (activeEnrollments && activeEnrollments.length > 0) {
      const eIds = activeEnrollments.map((e) => e.id);
      await supabase
        .from('enrollments')
        .update({
          status: '已中止',
          notes: `系統自動中止：離校日期 ${leaveDate}`,
        })
        .in('id', eIds);
    }

    await supabase.from('class_students').delete().eq('student_id', req.student_id);

  } else if (req.request_type === 'purchase') {
    if (!isCashPaid) {
      let parsed: any = {};
      try {
        parsed = JSON.parse(req.reason || '{}');
      } catch (e) {}

      const amount = parsed.price && parsed.qty ? parsed.price * parsed.qty : 0;
      await supabase.from('student_charges').insert({
        student_id: req.student_id,
        amount: amount,
        item_details: parsed,
        status: 'pending_billing',
        reference_id: id,
      });
    }
  } else if (req.request_type === 'half_day') {
    let parsed: { dates: string[]; halfDayType: 'AM' | 'PM'; includeMeal: boolean } =
      { dates: [], halfDayType: 'AM', includeMeal: false };
    try { parsed = JSON.parse(req.reason || '{}'); } catch (e) {}

    const { data: stu } = await supabase
      .from('students')
      .select('half_day_am_dates, half_day_pm_dates, half_day_meal_dates')
      .eq('id', req.student_id)
      .single();

    const updates: Record<string, string[]> = {};
    if (parsed.halfDayType === 'PM') {
      updates.half_day_pm_dates = mergeAndSort(stu?.half_day_pm_dates ?? [], parsed.dates);
    } else {
      updates.half_day_am_dates = mergeAndSort(stu?.half_day_am_dates ?? [], parsed.dates);
    }
    if (parsed.includeMeal) {
      updates.half_day_meal_dates = mergeAndSort(stu?.half_day_meal_dates ?? [], parsed.dates);
    }

    await supabase.from('students').update(updates).eq('id', req.student_id);

    const billingMonths = [...new Set(parsed.dates.map((d) => normalizeDate(d).substring(0, 7)))];
    for (const bm of billingMonths) {
      await rebillStudent(req.student_id, bm).catch(() => {});
    }
  } else if (req.request_type === 'meal') {
    let parsed: { dates: string[] } = { dates: [] };
    try { parsed = JSON.parse(req.reason || '{}'); } catch (e) {}

    const { data: stu } = await supabase
      .from('students')
      .select('half_day_meal_dates')
      .eq('id', req.student_id)
      .single();

    const newMealDates = mergeAndSort(stu?.half_day_meal_dates ?? [], parsed.dates);
    await supabase.from('students').update({ half_day_meal_dates: newMealDates }).eq('id', req.student_id);

    const billingMonths = [...new Set(parsed.dates.map((d) => normalizeDate(d).substring(0, 7)))];
    for (const bm of billingMonths) {
      await rebillStudent(req.student_id, bm).catch(() => {});
    }
  }

  const handledBy = await getHandledBy(supabase);
  await supabase.from('student_requests').update({
    status: 'approved',
    handled_by: handledBy,
    handled_at: new Date().toISOString(),
  }).eq('id', id);
  await supabase.from('request_audit_log').insert({
    request_table: 'student_requests',
    request_id: id,
    from_status: req.status ?? 'pending',
    to_status: 'approved',
    handled_by: handledBy,
  });
  // 審核完成 → 自動結案對應任務
  await resolveTaskBySourceId(id).catch(() => {});
  revalidatePath('/admin/requests');
  revalidatePath('/admin/classes');
  revalidatePath('/enrollments');
  revalidatePath('/students');
  revalidatePath('/teacher');
  revalidatePath('/admin/classes/matrix');
}

export async function rejectCancelRequest(id: string) {
  const supabase = createServerClient();

  const { data: req } = await supabase
    .from('student_requests')
    .select('status')
    .eq('id', id)
    .single();

  const handledBy = await getHandledBy(supabase);
  await supabase.from('student_requests').update({
    status: 'rejected',
    handled_by: handledBy,
    handled_at: new Date().toISOString(),
  }).eq('id', id);
  await supabase.from('request_audit_log').insert({
    request_table: 'student_requests',
    request_id: id,
    from_status: req?.status ?? 'pending',
    to_status: 'rejected',
    handled_by: handledBy,
  });
  // 退回也視為處理完成 → 自動結案對應任務
  await resolveTaskBySourceId(id).catch(() => {});
  revalidatePath('/admin/requests');
}
