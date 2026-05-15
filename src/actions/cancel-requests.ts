'use server';
import { createServerClient, createSessionClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

async function getHandledBy(supabase: ReturnType<typeof createServerClient>): Promise<string | null> {
  try {
    const sessionClient = await createSessionClient();
    const { data: { user } } = await sessionClient.auth.getUser();
    if (!user) return null;
    const { data: t } = await supabase.from('teachers').select('id').eq('user_id', user.id).single();
    return t?.id ?? null;
  } catch {
    return null;
  }
}

export type StudentEnrollment = {
  enrollmentId: string;
  courseId: string;
  courseName: string;
};

export async function getStudentEnrollments(studentId: string): Promise<StudentEnrollment[]> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('enrollments')
    .select('id, course_id, courses(name, course_type)')
    .eq('student_id', studentId)
    .eq('status', '生效');
  return (data ?? [])
    .filter((e: any) => e.courses?.course_type !== 'material')
    .map((e: any) => ({
      enrollmentId: e.id,
      courseId: e.course_id,
      courseName: e.courses?.name ?? '—',
    }));
}

export async function submitCancelRequest(data: {
  teacherId: string;
  studentId: string;
  courseId?: string | null;
  reason: string;
  requestType: 'cancel' | 'add' | 'purchase' | 'departure';
}) {
  const supabase = createServerClient();
  const { error } = await supabase.from('student_requests').insert({
    teacher_id: data.teacherId,
    student_id: data.studentId,
    course_id: data.courseId || null,
    class_id: null,
    reason: data.reason,
    request_type: data.requestType,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/teacher');
}

export async function approveCancelRequest(id: string, isCashPaid?: boolean) {
  const supabase = createServerClient();
  const { data: req, error } = await supabase
    .from('student_requests')
    .select('student_id, course_id, request_type, reason, status')
    .eq('id', id)
    .single();
  if (error || !req) throw new Error('找不到申請');

  if (req.request_type === 'cancel') {
    if (req.course_id) {
      await supabase
        .from('enrollments')
        .update({ status: '退班' })
        .eq('student_id', req.student_id)
        .eq('course_id', req.course_id)
        .eq('status', '生效');

      // 移除所有綁定此課程的班級名單
      const { data: linkedClasses } = await supabase
        .from('classes')
        .select('id')
        .eq('course_id', req.course_id);

      if (linkedClasses && linkedClasses.length > 0) {
        const classIds = linkedClasses.map((c) => c.id);
        await supabase
          .from('class_students')
          .delete()
          .eq('student_id', req.student_id)
          .in('class_id', classIds);
      }
    }
  } else if (req.request_type === 'add') {
    // 加報：建立候補合約，行政人員可進一步確認
    if (req.course_id) {
      const { data: student } = await supabase
        .from('students')
        .select('campus')
        .eq('id', req.student_id)
        .single();

      await supabase.from('enrollments').insert({
        student_id: req.student_id,
        course_id: req.course_id,
        campus: student?.campus ?? '文府總校',
        start_date: new Date().toISOString().split('T')[0],
        status: '候補',
        contract_no: `REQ-${Date.now()}`,
      });
    }
  } else if (req.request_type === 'departure') {
    let leaveDate = new Date().toISOString().split('T')[0];
    try {
      const parsed = JSON.parse(req.reason || '{}');
      if (parsed.date) leaveDate = parsed.date;
    } catch (e) {}

    // 1. 變更學生狀態
    await supabase.from('students').update({ status: '已離校' }).eq('id', req.student_id);

    // 2. 中止所有生效合約
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
          notes: `系統自動中止：離校日期 ${leaveDate}` 
        })
        .in('id', eIds);
    }

    // 3. 移除班級
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
        reference_id: id
      });
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
  revalidatePath('/admin/requests');
  revalidatePath('/admin/classes');
  revalidatePath('/enrollments');
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
  revalidatePath('/admin/requests');
}
