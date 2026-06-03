export const dynamic = 'force-dynamic';

import { createSessionClient, createServerClient } from '@/lib/supabase/server';
import { getTeacherByUser } from '@/lib/get-teacher';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import LeaveCalendarGrid, { buildGridDates, type LeavesByDate } from '@/components/leaves/LeaveCalendarGrid';
import TutorFilterCheckbox from '@/components/teacher/TutorFilterCheckbox';

export default async function TeacherCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; view?: string; tutorOnly?: string }>;
}) {
  const { month, view: viewParam, tutorOnly: tutorOnlyParam } = await searchParams;
  const tutorOnly = tutorOnlyParam === '1';

  const session = await createSessionClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) redirect('/login');

  const supabase = createServerClient();
  const selfTeacher = await getTeacherByUser(supabase, user.id, user.email, 'id, name, campus, is_supervisor');
  if (!selfTeacher) redirect('/');

  // 督導師模式：?view=<teacher_id> 切換 targetTeacher
  let targetTeacher: { id: string; name: string; campus: string | null } = selfTeacher as any;
  const isSupervisor = (selfTeacher as any).is_supervisor;

  if (isSupervisor && viewParam) {
    const { data: accessRows } = await supabase
      .from('supervisor_teacher_access')
      .select('viewable_teacher_id')
      .eq('supervisor_id', (selfTeacher as any).id);
    const accessIds = (accessRows ?? []).map((r: any) => r.viewable_teacher_id as string);
    if (accessIds.includes(viewParam)) {
      const { data: viewed } = await supabase
        .from('teachers')
        .select('id, name, campus')
        .eq('id', viewParam)
        .single();
      if (viewed) targetTeacher = viewed as any;
    }
  }

  const teacherCampus = targetTeacher.campus;
  const now = new Date();
  const currentMonth = month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [y, m] = currentMonth.split('-').map(Number);
  const { startDate, endDate } = buildGridDates(y, m);

  // 依篩選模式取得 studentIds
  let studentIds: string[] = [];

  if (tutorOnly) {
    // 只顯示我負責的學生（main_tutor_id）
    const { data } = await supabase
      .from('students')
      .select('id')
      .eq('main_tutor_id', (targetTeacher as any).id)
      .eq('status', '就讀中');
    studentIds = (data ?? []).map((s: any) => s.id as string);
  } else if (teacherCampus) {
    // 顯示同校區所有在籍學生
    const { data } = await supabase
      .from('students')
      .select('id')
      .eq('campus', teacherCampus)
      .eq('status', '就讀中');
    studentIds = (data ?? []).map((s: any) => s.id as string);
  }

  // 查詢這些學生在網格日期範圍內的請假紀錄
  const { data: leaves } = studentIds.length > 0
    ? await supabase
        .from('student_leaves')
        .select('id, leave_date, leave_type, students(name, english_name, enrollment_date)')
        .gte('leave_date', startDate)
        .lt('leave_date', endDate)
        .in('student_id', studentIds)
        .order('leave_date')
    : { data: [] };

  const leavesByDate: LeavesByDate = {};
  for (const l of leaves ?? []) {
    const key = (l as any).leave_date as string;
    if (!leavesByDate[key]) leavesByDate[key] = [];
    leavesByDate[key].push(l as any);
  }

  function monthNav(delta: number) {
    const d = new Date(y, m - 1 + delta, 1);
    const mo = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const p = new URLSearchParams();
    p.set('month', mo);
    if (viewParam) p.set('view', viewParam);
    if (tutorOnly) p.set('tutorOnly', '1');
    return `/teacher/calendar?${p}`;
  }

  const displayMonth = `${y} 年 ${m} 月`;
  const isViewingOther = targetTeacher.id !== (selfTeacher as any).id;
  const totalLeaves = (leaves ?? []).length;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">請假日曆</h1>
          {isViewingOther && (
            <p className="text-xs text-amber-600 font-medium mt-0.5">
              督導模式：{targetTeacher.name} 老師
            </p>
          )}
          {teacherCampus && !tutorOnly && (
            <p className="text-xs text-muted-foreground mt-0.5">{teacherCampus}</p>
          )}
        </div>
        <Suspense fallback={null}>
          <TutorFilterCheckbox tutorOnly={tutorOnly} />
        </Suspense>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Link
          href={monthNav(-1)}
          className="text-sm px-3 py-1.5 rounded-md border border-input hover:bg-muted transition-colors"
        >
          ‹ 上個月
        </Link>
        <span className="text-base font-semibold w-28 text-center">{displayMonth}</span>
        <Link
          href={monthNav(1)}
          className="text-sm px-3 py-1.5 rounded-md border border-input hover:bg-muted transition-colors"
        >
          下個月 ›
        </Link>
        <span className="text-sm text-muted-foreground ml-1">共 {totalLeaves} 筆</span>
      </div>

      {!teacherCampus && !tutorOnly ? (
        <div className="rounded-xl border bg-background p-8 text-center text-sm text-muted-foreground">
          您的帳號尚未設定校區，請聯繫行政人員。
        </div>
      ) : studentIds.length === 0 && tutorOnly ? (
        <div className="rounded-xl border bg-background p-8 text-center text-sm text-muted-foreground">
          您目前沒有設定總導師的在籍學生。
        </div>
      ) : (
        <LeaveCalendarGrid
          leavesByDate={leavesByDate}
          currentMonth={currentMonth}
          y={y}
          m={m}
        />
      )}
    </div>
  );
}
