import { createSessionClient, createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Eye } from 'lucide-react';
import StudentRoster, { type StudentRow } from '@/components/teacher/StudentRoster';
import TeacherViewSwitcher from '@/components/teacher/TeacherViewSwitcher';

export default async function TeacherStudentsPage(
  props: { searchParams?: Promise<{ view?: string }> }
) {
  const searchParams = await props.searchParams;
  const viewParam = searchParams?.view;

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

  const { data: students } = await supabase
    .from('students')
    .select('id, name, english_name, leave_note, registration_note')
    .eq('main_tutor_id', targetTeacher.id)
    .eq('status', '就讀中')
    .order('name');

  const studentIds = (students ?? []).map((s: any) => s.id);

  let classStudents: any[] = [];
  let enrollments: any[] = [];
  let leaveData: any[] = [];

  if (studentIds.length > 0) {
    const [{ data: csData }, { data: enData }, { data: lvData }] = await Promise.all([
      supabase
        .from('class_students')
        .select('student_id, classes(id, name, academic_year, term)')
        .in('student_id', studentIds),
      supabase
        .from('enrollments')
        .select('student_id, start_date, courses(id, name, course_type)')
        .in('student_id', studentIds)
        .eq('status', '生效'),
      supabase
        .from('leave_requests')
        .select('student_id, leave_date, leave_date_end, note, status')
        .in('student_id', studentIds)
        .in('status', ['pending', 'approved'])
        .order('leave_date'),
    ]);
    classStudents = csData ?? [];
    enrollments = enData ?? [];
    leaveData = lvData ?? [];
  }

  const studentClassMap = new Map<string, string[]>();
  for (const cs of classStudents) {
    const cls = (cs as any).classes;
    if (!cls) continue;
    if (!studentClassMap.has(cs.student_id)) studentClassMap.set(cs.student_id, []);
    const suffix = [cls.academic_year, cls.term].filter(Boolean).join(' ');
    studentClassMap.get(cs.student_id)!.push(suffix ? `${cls.name}（${suffix}）` : cls.name);
  }

  const COURSE_TYPE_ORDER: Record<string, number> = { main_course: 0, camp: 1, trip: 2 };

  const julyMap = new Map<string, { name: string; order: number }[]>();
  const augustMap = new Map<string, { name: string; order: number }[]>();
  for (const e of enrollments) {
    const c = (e as any).courses;
    if (!c || c.course_type === 'material') continue;
    const month = (e.start_date ?? '').slice(5, 7);
    const entry = { name: c.name, order: COURSE_TYPE_ORDER[c.course_type] ?? 99 };
    if (month === '07') {
      if (!julyMap.has(e.student_id)) julyMap.set(e.student_id, []);
      julyMap.get(e.student_id)!.push(entry);
    } else if (month === '08') {
      if (!augustMap.has(e.student_id)) augustMap.set(e.student_id, []);
      augustMap.get(e.student_id)!.push(entry);
    }
  }

  const leaveMap = new Map<string, { date: string; endDate: string | null; note: string | null }[]>();
  for (const l of leaveData) {
    if (!leaveMap.has(l.student_id)) leaveMap.set(l.student_id, []);
    leaveMap.get(l.student_id)!.push({
      date: l.leave_date,
      endDate: l.leave_date_end ?? null,
      note: l.note ?? null,
    });
  }

  const rows: StudentRow[] = (students ?? []).map((s: any) => ({
    id: s.id,
    name: s.name ?? '—',
    englishName: s.english_name ?? null,
    classes: studentClassMap.get(s.id) ?? [],
    julyEnrollments: (julyMap.get(s.id) ?? []).sort((a, b) => a.order - b.order).map(x => x.name),
    augustEnrollments: (augustMap.get(s.id) ?? []).sort((a, b) => a.order - b.order).map(x => x.name),
    leaves: leaveMap.get(s.id) ?? [],
    leaveNote: s.leave_note ?? null,
    registrationNote: s.registration_note ?? null,
  }));

  const backHref = isViewingOther ? `/teacher?view=${targetTeacher.id}` : '/teacher';

  return (
    <div className="min-h-screen flex items-start justify-center bg-muted/30 pt-16 px-4 pb-16">
      <div className="w-full max-w-4xl space-y-6">
        {/* 督導切換器 */}
        {selfTeacher.is_supervisor && (
          <TeacherViewSwitcher
            allTeachers={allTeachers}
            selfId={selfTeacher.id}
            currentViewId={targetTeacher.id}
          />
        )}

        <div className="flex items-center justify-between">
          <div>
            <Link href={backHref} className="text-sm text-muted-foreground hover:text-foreground">
              ← 返回
            </Link>
            {isViewingOther && (
              <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium mt-1 mb-0.5">
                <Eye className="w-3 h-3" />
                督導模式
              </div>
            )}
            <h1 className="text-xl font-bold mt-1">
              {isViewingOther ? `正在查看：${targetTeacher.name} 老師的學生` : '我的學生'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {targetTeacher.name}　{targetTeacher.campus}
            </p>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="bg-background rounded-xl border shadow-sm p-8 text-center text-sm text-muted-foreground">
            {isViewingOther
              ? `目前沒有設定 ${targetTeacher.name} 老師為總導師的學生。`
              : '目前沒有設定您為總導師的學生。'}
          </div>
        ) : (
          <div className="bg-background rounded-xl border shadow-sm p-6">
            <StudentRoster rows={rows} />
          </div>
        )}
      </div>
    </div>
  );
}
