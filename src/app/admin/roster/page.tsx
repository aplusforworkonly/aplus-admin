import { createServerClient } from '@/lib/supabase/server';
import { getGrade } from '@/lib/grade';
import EnrollmentOverview, { type EnrollmentRow, type TutorOption } from '@/components/admin/EnrollmentOverview';

export default async function AdminRosterPage() {
  const supabase = createServerClient();

  const [
    { data: students },
    { data: teachers },
    { data: enrollments },
    { data: leaveData },
  ] = await Promise.all([
    supabase
      .from('students')
      .select('id, name, english_name, enrollment_date, main_tutor_id, campus, registration_note, leave_note, program_type, is_school_student')
      .eq('status', '就讀中')
      .order('name'),
    supabase
      .from('teachers')
      .select('id, name, english_name, campus, department')
      .neq('status', '離職')
      .order('name'),
    supabase
      .from('enrollments')
      .select('student_id, start_date, courses(name, course_type)')
      .eq('status', '生效'),
    supabase
      .from('leave_requests')
      .select('student_id, leave_date, leave_date_end, note, status')
      .eq('status', 'approved')
      .order('leave_date'),
  ]);

  const studentIds = (students ?? []).map((s: any) => s.id);

  const { data: classData } = studentIds.length > 0
    ? await supabase
        .from('class_students')
        .select('student_id')
        .in('student_id', studentIds)
    : { data: [] };

  const assignedToClassSet = new Set((classData ?? []).map((c: any) => c.student_id));

  function normalizeCampus(campus: string | null): string {
    if (campus === '總校') return '文府總校';
    return campus ?? '';
  }

  const tutorMap: Record<string, { name: string; englishName: string | null; campus: string; department: string | null }> = {};
  for (const t of teachers ?? []) {
    tutorMap[(t as any).id] = {
      name: (t as any).name,
      englishName: (t as any).english_name ?? null,
      campus: normalizeCampus((t as any).campus),
      department: (t as any).department ?? null,
    };
  }

  const COURSE_TYPE_ORDER: Record<string, number> = { main_course: 0, camp: 1, trip: 2 };

  const julyRaw: Record<string, { name: string; order: number }[]> = {};
  const augustRaw: Record<string, { name: string; order: number }[]> = {};
  for (const e of enrollments ?? []) {
    const c = (e as any).courses;
    if (!c || c.course_type === 'material') continue;
    const month = ((e as any).start_date ?? '').slice(5, 7);
    const entry = { name: c.name, order: COURSE_TYPE_ORDER[c.course_type] ?? 99 };
    const sid = (e as any).student_id;
    if (month === '07') {
      julyRaw[sid] = [...(julyRaw[sid] ?? []), entry];
    } else if (month === '08') {
      augustRaw[sid] = [...(augustRaw[sid] ?? []), entry];
    }
  }
  const julyMap: Record<string, string[]> = {};
  const augustMap: Record<string, string[]> = {};
  for (const [sid, entries] of Object.entries(julyRaw)) {
    julyMap[sid] = entries.sort((a, b) => a.order - b.order).map((e) => e.name);
  }
  for (const [sid, entries] of Object.entries(augustRaw)) {
    augustMap[sid] = entries.sort((a, b) => a.order - b.order).map((e) => e.name);
  }

  const leaveMap: Record<string, { date: string; endDate: string | null; note: string | null }[]> = {};
  for (const l of leaveData ?? []) {
    const sid = (l as any).student_id;
    if (!leaveMap[sid]) leaveMap[sid] = [];
    leaveMap[sid].push({
      date: (l as any).leave_date,
      endDate: (l as any).leave_date_end ?? null,
      note: (l as any).note ?? null,
    });
  }

  const rows: EnrollmentRow[] = (students ?? []).map((s: any) => {
    const tutor = s.main_tutor_id ? tutorMap[s.main_tutor_id] : null;
    const tutorDisplay = tutor
      ? (tutor.englishName ? `${tutor.englishName}（${tutor.name}）` : tutor.name)
      : '';
    return {
      id: s.id,
      name: s.name ?? '—',
      englishName: s.english_name ?? null,
      grade: getGrade(s.enrollment_date),
      campus: s.campus ?? '',
      mainTutorId: s.main_tutor_id ?? '',
      mainTutorName: tutorDisplay,
      mainTutorCampus: tutor?.campus ?? null,
      julyEnrollments: julyMap[s.id] ?? [],
      augustEnrollments: augustMap[s.id] ?? [],
      leaves: leaveMap[s.id] ?? [],
      leaveNote: s.leave_note ?? null,
      registrationNote: s.registration_note ?? null,
      hasClass: assignedToClassSet.has(s.id),
      programType: s.program_type ?? null,
      isSchoolStudent: s.is_school_student ?? false,
    };
  });

  const tutorOptions: TutorOption[] = (teachers ?? []).map((t: any) => ({
    id: t.id,
    name: t.english_name ? `${t.english_name}（${t.name}）` : t.name,
    campus: normalizeCampus(t.campus),
    department: t.department ?? null,
  }));

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">學生報名總覽</h1>
        <p className="text-sm text-muted-foreground mt-1">共 {rows.length} 位就讀中學生</p>
      </div>
      <div className="bg-background rounded-xl border shadow-sm p-6">
        <EnrollmentOverview rows={rows} tutorOptions={tutorOptions} />
      </div>
    </div>
  );
}
