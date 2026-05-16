import { createSessionClient, createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import TeacherLeaveForm from '@/components/teacher/TeacherLeaveForm';
import TeacherRequestHistory from '@/components/teacher/TeacherRequestHistory';
import TeacherViewSwitcher from '@/components/teacher/TeacherViewSwitcher';
import { ArrowRight, Info, History, Eye } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default async function TeacherPage(props: {
  searchParams?: Promise<{ tab?: string; view?: string }>;
}) {
  const searchParams = await props.searchParams;
  const tabParam = searchParams?.tab;
  const viewParam = searchParams?.view;
  const validTabs = ['leave', 'course', 'purchase', 'departure'] as const;
  const defaultTab = (validTabs.includes((tabParam as typeof validTabs[number]) || 'leave') ? tabParam : 'leave') as typeof validTabs[number];

  const session = await createSessionClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) redirect('/login');

  const supabase = createServerClient();

  const { data: selfTeacher } = await supabase
    .from('teachers')
    .select('id, name, campus, is_supervisor')
    .eq('user_id', user.id)
    .single();
  if (!selfTeacher) redirect('/');

  // 解析督導目標：非督導者忽略 view param
  let targetTeacher: { id: string; name: string; english_name?: string | null; campus: string } = selfTeacher;
  let allTeachers: { id: string; name: string; english_name: string | null; campus: string }[] = [];

  if (selfTeacher.is_supervisor) {
    const { data: teachers } = await supabase
      .from('teachers')
      .select('id, name, english_name, campus')
      .eq('status', '在職')
      .order('campus')
      .order('name');
    allTeachers = teachers ?? [];

    // 過濾可見範圍
    const { data: accessRows } = await supabase
      .from('supervisor_teacher_access')
      .select('viewable_teacher_id')
      .eq('supervisor_id', selfTeacher.id);
    const accessIds = (accessRows ?? []).map((r: any) => r.viewable_teacher_id);
    if (accessIds.length > 0) {
      allTeachers = allTeachers.filter(t => accessIds.includes(t.id));
    }

    if (viewParam) {
      const viewed = allTeachers.find(t => t.id === viewParam);
      if (viewed) targetTeacher = viewed;
    }
  }

  const isViewingOther = targetTeacher.id !== selfTeacher.id;

  const [{ data: studentsList }, { data: coursesList }, { data: cancelList }, { data: leaveList }] = await Promise.all([
    supabase
      .from('students')
      .select('id, name, english_name')
      .eq('main_tutor_id', targetTeacher.id)
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
      .eq('teacher_id', targetTeacher.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('leave_requests')
      .select('id, status, request_type, leave_date, leave_date_end, leave_type, reason, note, created_at, students(name, english_name)')
      .eq('teacher_id', targetTeacher.id)
      .order('created_at', { ascending: false }),
  ]);

  const students = (studentsList ?? []) as { id: string; name: string; english_name?: string | null }[];
  const courses = (coursesList ?? []) as { id: string; name: string }[];

  // 推導每門課有哪些月份（從 enrollments.start_date），供加報清單展開月份選項
  const courseIds = courses.map((c) => c.id);
  const courseMonths: Record<string, number[]> = {};
  if (courseIds.length > 0) {
    const { data: monthRows } = await supabase
      .from('enrollments')
      .select('course_id, start_date')
      .in('course_id', courseIds)
      .not('start_date', 'is', null);
    for (const row of monthRows ?? []) {
      const dateStr = (row as any).start_date as string;
      if (!dateStr) continue;
      const month = parseInt(dateStr.substring(5, 7));
      if (!courseMonths[(row as any).course_id]) courseMonths[(row as any).course_id] = [];
      if (!courseMonths[(row as any).course_id].includes(month)) courseMonths[(row as any).course_id].push(month);
    }
    for (const cid of Object.keys(courseMonths)) courseMonths[cid].sort((a, b) => a - b);
  }

  const cancelRequests = (cancelList ?? []).map((r: any) => {
    let typeStr = '取消課程';
    let detailStr = r.courses?.name ?? null;
    let reasonStr = r.reason ?? '';

    if (r.request_type === 'add') typeStr = '加報課程';
    else if (r.request_type === 'purchase') {
      typeStr = '購買物品';
      detailStr = null;
      try {
        const parsed = JSON.parse(r.reason);
        reasonStr = `品項：${parsed.item}，數量：${parsed.qty}`;
      } catch (e) {}
    } else if (r.request_type === 'departure') {
      typeStr = '學生離校';
      detailStr = null;
      try {
        const parsed = JSON.parse(r.reason);
        reasonStr = `[離校日期: ${parsed.date}] ${parsed.reason}`;
      } catch (e) {}
    }

    return {
      id: `cancel-${r.id}`,
      type: typeStr as any,
      status: r.status,
      studentName: r.students?.name ?? '—',
      studentEnglishName: r.students?.english_name ?? null,
      detail: detailStr,
      reason: reasonStr,
      created_at: r.created_at,
    };
  });

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

  const studentsPageHref = isViewingOther
    ? `/teacher/students?view=${targetTeacher.id}`
    : '/teacher/students';

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      {/* 督導切換器 */}
      {selfTeacher.is_supervisor && (
        <TeacherViewSwitcher
          allTeachers={allTeachers}
          selfId={selfTeacher.id}
          currentViewId={targetTeacher.id}
        />
      )}

      <Card className="rounded-xl border-slate-200 shadow-sm bg-slate-50/50">
        <CardContent className="p-4 sm:p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              {isViewingOther && (
                <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium mb-1">
                  <Eye className="w-3.5 h-3.5" />
                  督導模式
                </div>
              )}
              <h2 className="text-2xl font-bold text-teal-950 mb-1">
                {isViewingOther ? `正在查看：${targetTeacher.name} 老師` : '學生異動回報'}
              </h2>
              <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                <span>{targetTeacher.name}</span>
                <span className="w-1 h-1 bg-border rounded-full"></span>
                <span>{targetTeacher.campus}</span>
              </div>
            </div>
            <a
              href={studentsPageHref}
              className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-medium text-teal-800 hover:bg-slate-100 transition-colors shrink-0"
            >
              查看學生狀態 <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          {/* 非督導查看模式才顯示表單 */}
          {!isViewingOther && (
            <TeacherLeaveForm teacherId={selfTeacher.id} students={students} courses={courses} courseMonths={courseMonths} defaultTab={defaultTab} />
          )}
        </CardContent>
      </Card>

      {/* 說明卡片只在自己的頁面顯示 */}
      {!isViewingOther && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-rose-50 text-rose-900 p-5 rounded-xl border border-rose-100">
            <Info className="w-6 h-6 mb-2 text-rose-700" />
            <h4 className="font-bold text-sm">注意事項</h4>
            <p className="text-sm mt-2 opacity-90">
              法定傳染疾病因為與退費相關，需上傳證明文件才可以送出。
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
      )}

      <div className="space-y-4 pt-4">
        <h3 className="text-xl font-bold text-foreground">
          {isViewingOther ? `${targetTeacher.name} 老師的申請紀錄` : '我的申請與處理進度'}
        </h3>
        <TeacherRequestHistory requests={requests} />
      </div>
    </main>
  );
}
