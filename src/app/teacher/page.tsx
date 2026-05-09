import { createSessionClient, createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import TeacherLeaveForm from '@/components/teacher/TeacherLeaveForm';
import TeacherRequestHistory from '@/components/teacher/TeacherRequestHistory';
import { ArrowRight, Info, History } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default async function TeacherPage(props: { searchParams?: Promise<{ tab?: string }> }) {
  const searchParams = await props.searchParams;
  const defaultTab = searchParams?.tab === 'course' ? 'course' : 'leave';
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
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <Card className="rounded-xl border-slate-200 shadow-sm bg-slate-50/50">
        <CardContent className="p-4 sm:p-6">
          {/* Header Section */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-teal-950 mb-1">學生異動回報</h2>
              <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                <span>{teacher.name}</span>
                <span className="w-1 h-1 bg-border rounded-full"></span>
                <span>{teacher.campus}</span>
              </div>
            </div>
            <a
              href="/teacher/students"
              className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-medium text-teal-800 hover:bg-slate-100 transition-colors shrink-0"
            >
              查看學生狀態 <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          <TeacherLeaveForm teacherId={teacher.id} students={students} courses={courses} defaultTab={defaultTab} />
        </CardContent>
      </Card>

      {/* Asymmetric Info Card - Translated from Stitch */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-rose-50 text-rose-900 p-5 rounded-xl border border-rose-100">
          <Info className="w-6 h-6 mb-2 text-rose-700" />
          <h4 className="font-bold text-sm">注意事項</h4>
          <p className="text-sm mt-2 opacity-90">
            請於三日前完成事假報備，以利調課安排。<br />
            法定傳染病需上傳證明文件始可送出。
          </p>
        </div>
        <div className="bg-teal-900 text-teal-50 p-5 rounded-xl flex flex-col justify-end shadow-md">
          <History className="w-6 h-6 mb-2 text-teal-300" />
          <h4 className="font-bold text-sm">進度追蹤</h4>
          <p className="text-sm mt-2 opacity-90">
            下方列表為您過去的異動與請假申請，<br />
            可追蹤行政處理進度。
          </p>
        </div>
      </div>

      <div className="space-y-4 pt-4">
        <h3 className="text-xl font-bold text-foreground">我的申請與處理進度</h3>
        <TeacherRequestHistory requests={requests} />
      </div>
    </main>
  );
}
