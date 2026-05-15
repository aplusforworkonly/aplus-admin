'use server';
import { revalidatePath } from 'next/cache';
import { createServerClient, createSessionClient } from '@/lib/supabase/server';

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

export async function approveLeaveRequest(id: string) {
  const supabase = createServerClient();

  const { data: req, error } = await supabase
    .from('leave_requests')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !req) throw new Error('找不到申請');

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
  }

  const handledBy = await getHandledBy(supabase);
  await supabase.from('leave_requests').update({
    status: 'approved',
    handled_by: handledBy,
    handled_at: new Date().toISOString(),
  }).eq('id', id);
  await supabase.from('request_audit_log').insert({
    request_table: 'leave_requests',
    request_id: id,
    from_status: req.status,
    to_status: 'approved',
    handled_by: handledBy,
  });
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
  revalidatePath('/leaves');
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

  const { error } = await supabase.from('leave_requests').insert({
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
  });
  if (error) throw new Error(error.message);
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
  const { error } = await supabase.from('leave_requests').insert({
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
  });
  if (error) throw new Error(error.message);
  revalidatePath('/teacher');
}
