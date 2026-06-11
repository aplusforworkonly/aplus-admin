'use server';
import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminTask, resolveTaskBySourceId } from '@/actions/admin-tasks';
import { getHandledBy } from '@/actions/shared';

function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(start);
  const last = new Date(end);
  while (cur <= last) {
    dates.push(cur.toISOString().split('T')[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}


export async function approveLeaveRequest(id: string) {
  const supabase = createServerClient();

  const { data: req, error } = await supabase
    .from('leave_requests')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !req) throw new Error('找不到申請');

  const handledBy = await getHandledBy(supabase);
  const now = new Date().toISOString();

  if (req.request_type === '請假') {
    const dates = dateRange(req.leave_date, req.leave_date_end ?? req.leave_date);
    await supabase.from('student_leaves').insert(
      dates.map((d) => ({
        student_id: req.student_id,
        leave_date: d,
        leave_type: req.leave_type,
        note: req.reason ?? req.note ?? null,
      }))
    );
  } else if (req.request_type === '退班') {
    await supabase
      .from('enrollments')
      .update({ status: '退班' })
      .eq('student_id', req.student_id)
      .eq('course_id', req.course_id);
  } else if (req.request_type === '取消請假' && req.ref_request_id) {
    const { data: original } = await supabase
      .from('leave_requests')
      .select('student_id, leave_date, leave_date_end, status')
      .eq('id', req.ref_request_id)
      .single();

    if (original?.status === 'approved') {
      await supabase.from('student_leaves').delete()
        .eq('student_id', original.student_id)
        .gte('leave_date', original.leave_date)
        .lte('leave_date', original.leave_date_end ?? original.leave_date);
    }

    await supabase.from('leave_requests').update({
      status: 'cancelled',
      handled_by: handledBy,
      handled_at: now,
    }).eq('id', req.ref_request_id);

    await supabase.from('request_audit_log').insert({
      request_table: 'leave_requests',
      request_id: req.ref_request_id,
      from_status: original?.status ?? 'approved',
      to_status: 'cancelled',
      handled_by: handledBy,
    });
  }

  await supabase.from('leave_requests').update({
    status: 'approved',
    handled_by: handledBy,
    handled_at: now,
  }).eq('id', id);
  await supabase.from('request_audit_log').insert({
    request_table: 'leave_requests',
    request_id: id,
    from_status: req.status,
    to_status: 'approved',
    handled_by: handledBy,
  });
  // 審核完成 → 自動結案對應任務（靜默失敗，不影響主流程）
  await resolveTaskBySourceId(id).catch(() => {});
  revalidatePath('/leaves');
}

export async function rejectLeaveRequest(id: string) {
  const supabase = createServerClient();

  const { data: req } = await supabase
    .from('leave_requests')
    .select('status')
    .eq('id', id)
    .single();

  const handledBy = await getHandledBy(supabase);
  await supabase.from('leave_requests').update({
    status: 'rejected',
    handled_by: handledBy,
    handled_at: new Date().toISOString(),
  }).eq('id', id);
  await supabase.from('request_audit_log').insert({
    request_table: 'leave_requests',
    request_id: id,
    from_status: req?.status ?? 'pending',
    to_status: 'rejected',
    handled_by: handledBy,
  });
  // 退回也視為處理完成 → 自動結案對應任務
  await resolveTaskBySourceId(id).catch(() => {});
  revalidatePath('/leaves');
}

export async function cancelLeaveRequest(id: string) {
  const supabase = createServerClient();

  const { data: req } = await supabase
    .from('leave_requests')
    .select('id, status, student_id, leave_date, leave_date_end')
    .eq('id', id)
    .single();

  if (!req || !['pending', 'approved'].includes(req.status)) throw new Error('此申請無法取消');

  if (req.status === 'approved') {
    await supabase.from('student_leaves').delete()
      .eq('student_id', req.student_id)
      .gte('leave_date', req.leave_date)
      .lte('leave_date', req.leave_date_end ?? req.leave_date);
  }

  const handledBy = await getHandledBy(supabase);
  const now = new Date().toISOString();

  await supabase.from('leave_requests').update({
    status: 'cancelled',
    handled_by: handledBy,
    handled_at: now,
  }).eq('id', id);

  await supabase.from('request_audit_log').insert({
    request_table: 'leave_requests',
    request_id: id,
    from_status: req.status,
    to_status: 'cancelled',
    handled_by: handledBy,
  });

  revalidatePath('/leaves');
  revalidatePath(`/students/${req.student_id}`);
}

export async function submitCancellationRequest(
  refRequestId: string,
  teacherId: string,
  reason: string
) {
  const supabase = createServerClient();

  const { count } = await supabase
    .from('leave_requests')
    .select('id', { count: 'exact', head: true })
    .eq('ref_request_id', refRequestId)
    .eq('request_type', '取消請假')
    .eq('status', 'pending');
  if ((count ?? 0) > 0) throw new Error('已有取消申請審核中，請等待行政處理');

  const { data: original } = await supabase
    .from('leave_requests')
    .select('student_id, leave_date, leave_date_end, leave_type')
    .eq('id', refRequestId)
    .single();
  if (!original) throw new Error('找不到原始請假申請');

  const { error } = await supabase.from('leave_requests').insert({
    request_type: '取消請假',
    student_id: original.student_id,
    teacher_id: teacherId,
    leave_date: original.leave_date,
    leave_date_end: original.leave_date_end,
    leave_type: original.leave_type,
    reason: reason || '家長通知取消請假',
    ref_request_id: refRequestId,
    status: 'pending',
  });
  if (error) throw new Error(error.message);

  revalidatePath('/teacher');
}

export async function submitParentLeaveRequest(data: {
  phone: string;
  studentId: string;
  leaveDate: string;
  leaveDateEnd: string;
  leaveType: string;
  reason: string;
  note?: string;
  diseaseType?: string;
  proofFileUrl?: string;
}) {
  const supabase = createServerClient();

  const { data: parent, error: parentErr } = await supabase
    .from('parents')
    .select('id')
    .eq('phone', data.phone)
    .single();
  if (parentErr || !parent) throw new Error('查無此手機號碼，請確認後再試。');

  const { data: mapping } = await supabase
    .from('parent_student_mapping')
    .select('id')
    .eq('parent_id', parent.id)
    .eq('student_id', data.studentId)
    .single();
  if (!mapping) throw new Error('學生資料不符，請確認後再試。');

  const { data: inserted, error } = await supabase.from('leave_requests').insert({
    request_type: '請假',
    student_id: data.studentId,
    parent_id: parent.id,
    leave_date: data.leaveDate,
    leave_date_end: data.leaveDateEnd !== data.leaveDate ? data.leaveDateEnd : null,
    leave_type: data.leaveType,
    reason: data.reason,
    note: data.note ?? null,
    disease_type: data.diseaseType ?? null,
    proof_file_url: data.proofFileUrl ?? null,
  }).select('id').single();
  if (error) throw new Error(error.message);

  // 建立對應行政任務
  if (inserted?.id) {
    const { data: student } = await supabase
      .from('students').select('name, campus').eq('id', data.studentId).single();
    await createAdminTask({
      title: `審核請假申請：${student?.name ?? data.studentId} ${data.leaveDate}`,
      taskType: 'adhoc',
      taskSource: 'leave_request',
      sourceId: inserted.id,
      campus: student?.campus ? [student.campus] : undefined,
      priority: 'normal',
      size: 'S',
    }).catch(() => {});
  }
}

export async function getStudentCancellableLeaves(studentId: string) {
  const supabase = createServerClient();
  const d = new Date();
  d.setDate(d.getDate() - 7);
  const limitDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const { data, error } = await supabase
    .from('leave_requests')
    .select('id, leave_date, leave_date_end, leave_type, reason, status')
    .eq('student_id', studentId)
    .eq('request_type', '請假')
    .in('status', ['pending', 'approved'])
    .gte('leave_date', limitDate)
    .order('leave_date', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as {
    id: string;
    leave_date: string;
    leave_date_end: string | null;
    leave_type: string | null;
    reason: string | null;
    status: string;
  }[];
}

export async function submitLeaveRequest(data: {
  teacherId: string;
  studentId: string;
  requestType: '請假' | '退班';
  leaveDate?: string;
  leaveDateEnd?: string;
  leaveType?: string;
  courseId?: string;
  reason?: string;
  note?: string;
  diseaseType?: string;
  proofFileUrl?: string;
}) {
  const supabase = createServerClient();
  const { data: inserted, error } = await supabase.from('leave_requests').insert({
    request_type: data.requestType,
    student_id: data.studentId,
    teacher_id: data.teacherId,
    leave_date: data.leaveDate ?? null,
    leave_date_end: data.leaveDateEnd && data.leaveDateEnd !== data.leaveDate ? data.leaveDateEnd : null,
    leave_type: data.leaveType ?? null,
    course_id: data.courseId ?? null,
    reason: data.reason ?? null,
    note: data.note ?? null,
    disease_type: data.diseaseType ?? null,
    proof_file_url: data.proofFileUrl ?? null,
  }).select('id').single();
  if (error) throw new Error(error.message);

  // 建立對應行政任務
  if (inserted?.id) {
    const { data: student } = await supabase
      .from('students').select('name, campus').eq('id', data.studentId).single();
    const typeLabel = data.requestType === '退班' ? '退班申請' : '請假申請';
    await createAdminTask({
      title: `審核${typeLabel}：${student?.name ?? data.studentId}${data.leaveDate ? ` ${data.leaveDate}` : ''}`,
      taskType: 'adhoc',
      taskSource: 'leave_request',
      sourceId: inserted.id,
      campus: student?.campus ? [student.campus] : undefined,
      priority: 'normal',
      size: 'S',
    }).catch(() => {});
  }

  revalidatePath('/teacher');
}
