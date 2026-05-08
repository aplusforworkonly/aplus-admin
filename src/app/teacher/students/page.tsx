import { createSessionClient, createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import StudentRoster, { type StudentRow } from '@/components/teacher/StudentRoster';

export default async function TeacherStudentsPage() {
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

  // 以總導師 ID 直接找學生
  const { data: students } = await supabase
    .from('students')
    .select('id, name, english_name, leave_note, registration_note')
    .eq('main_tutor_id', teacher.id)
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

  // 學生 → 班級名稱列表
  const studentClassMap = new Map<string, string[]>();
  for (const cs of classStudents) {
    const cls = (cs as any).classes;
    if (!cls) continue;
    if (!studentClassMap.has(cs.student_id)) studentClassMap.set(cs.student_id, []);
    const suffix = [cls.academic_year, cls.term].filter(Boolean).join(' ');
    studentClassMap.get(cs.student_id)!.push(suffix ? `${cls.name}（${suffix}）` : cls.name);
  }

  // 學生 → 七月 / 八月課程
  const julyMap = new Map<string, string[]>();
  const augustMap = new Map<string, string[]>();
  for (const e of enrollments) {
    const c = (e as any).courses;
    if (!c || c.course_type === 'material') continue;
    const month = (e.start_date ?? '').slice(5, 7);
    if (month === '07') {
      if (!julyMap.has(e.student_id)) julyMap.set(e.student_id, []);
      julyMap.get(e.student_id)!.push(c.name);
    } else if (month === '08') {
      if (!augustMap.has(e.student_id)) augustMap.set(e.student_id, []);
      augustMap.get(e.student_id)!.push(c.name);
    }
  }

  // 學生 → 請假資料
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
    julyEnrollments: julyMap.get(s.id) ?? [],
    augustEnrollments: augustMap.get(s.id) ?? [],
    leaves: leaveMap.get(s.id) ?? [],
    leaveNote: s.leave_note ?? null,
    registrationNote: s.registration_note ?? null,
  }));

  return (
    <div className="min-h-screen flex items-start justify-center bg-muted/30 pt-16 px-4 pb-16">
      <div className="w-full max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/teacher" className="text-sm text-muted-foreground hover:text-foreground">
              ← 返回
            </Link>
            <h1 className="text-xl font-bold mt-1">我的學生</h1>
            <p className="text-sm text-muted-foreground">
              {teacher.name}　{teacher.campus}
            </p>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="bg-background rounded-xl border shadow-sm p-8 text-center text-sm text-muted-foreground">
            目前沒有設定您為總導師的學生。
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
