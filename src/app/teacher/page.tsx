import { createSessionClient, createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import TeacherLeaveForm from '@/components/teacher/TeacherLeaveForm';
import TeacherRequestHistory from '@/components/teacher/TeacherRequestHistory';
import Link from 'next/link';

export default async function TeacherPage() {
  const session = await createSessionClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) redirect('/login');

  const supabase = createServerClient();

  const { data: teacher } = await supabase
    .from('teachers')
    .select('id, name, campus')
    .eq('user_id', user.id)
    .single();

  if (!teacher) redirect('/');

  const [{ data: studentsList }, { data: coursesList }, { data: cancelList }, { data: leaveList }] = await Promise.all([
    supabase
      .from('students')
      .select('id, name, english_name')
      .eq('main_tutor_id', teacher.id)
      .eq('status', '就讀中')
      .order('name'),
    supabase
      .from('courses')
      .select('id, name')
      .neq('course_type', 'material')
      .order('name'),
    supabase
      .from('student_requests')
      .select('id, status, request_type, reason, created_at, students(name, english_name), courses(name)')
      .eq('teacher_id', teacher.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('leave_requests')
      .select('id, status, request_type, leave_date, leave_date_end, leave_type, reason, note, created_at, students(name, english_name)')
      .eq('teacher_id', teacher.id)
      .order('created_at', { ascending: false }),
  ]);

  const students = (studentsList ?? []) as { id: string; name: string; english_name?: string | null }[];
  const courses = (coursesList ?? []) as { id: string; name: string }[];

  const cancelRequests = (cancelList ?? []).map((r: any) => ({
    id: `cancel-${r.id}`,
    type: (r.request_type === 'add' ? '加報課程' : '取消課程') as '取消課程' | '加報課程',
    status: r.status,
    studentName: r.students?.name ?? '—',
    studentEnglishName: r.students?.english_name ?? null,
    detail: r.courses?.name ?? null,
    reason: r.reason ?? '',
    created_at: r.created_at,
  }));

  const leaveRequests = (leaveList ?? []).map((r: any) => {
    const dateRange = r.leave_date_end && r.leave_date_end !== r.leave_date
      ? `${r.leave_date} ～ ${r.leave_date_end}`
      : (r.leave_date ?? '');
    return {
      id: `leave-${r.id}`,
      type: '請假' as const,
      status: r.status,
      studentName: r.students?.name ?? '—',
      studentEnglishName: r.students?.english_name ?? null,
      detail: [dateRange, r.leave_type].filter(Boolean).join('　') || null,
      reason: r.reason ?? r.note ?? '',
      created_at: r.created_at,
    };
  });

  const requests = [...cancelRequests, ...leaveRequests].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="min-h-screen flex items-start justify-center bg-muted/30 pt-16 px-4 pb-16">
      <div className="w-full max-w-2xl space-y-8">
        <div className="bg-background rounded-xl border shadow-sm p-4 sm:p-8 space-y-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold">學生異動回報</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {teacher.name}　{teacher.campus}
              </p>
            </div>
            <Link
              href="/teacher/students"
              className="text-xs text-muted-foreground hover:text-foreground border rounded px-2.5 py-1.5 transition-colors hover:bg-muted shrink-0"
            >
              查看學生報名狀態 →
            </Link>
          </div>
          <TeacherLeaveForm teacherId={teacher.id} students={students} courses={courses} />
        </div>

        <div className="bg-background rounded-xl border shadow-sm p-4 sm:p-8 space-y-4">
          <div>
            <h2 className="text-base font-semibold">我的申請與處理進度</h2>
            <p className="text-xs text-muted-foreground mt-0.5">僅供檢視，如有疑問請聯繫行政人員。</p>
          </div>
          <TeacherRequestHistory requests={requests} />
        </div>
      </div>
    </div>
  );
}
