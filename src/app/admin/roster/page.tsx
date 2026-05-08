import { createServerClient } from '@/lib/supabase/server';
import { getGrade } from '@/lib/grade';
import EnrollmentOverview, { type EnrollmentRow } from '@/components/admin/EnrollmentOverview';

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
      .select('id, name, enrollment_date, main_tutor_id, registration_note, leave_note')
      .eq('status', '就讀中')
      .order('name'),
    supabase
      .from('teachers')
      .select('id, name')
      .neq('status', '離職')
      .order('name'),
    supabase
      .from('enrollments')
      .select('student_id, start_date, courses(name, course_type)')
      .eq('status', '生效'),
    supabase
      .from('leave_requests')
      .select('student_id, leave_date, leave_date_end, note, status')
      .in('status', ['pending', 'approved'])
      .order('leave_date'),
  ]);

  const tutorMap: Record<string, string> = {};
  for (const t of teachers ?? []) tutorMap[(t as any).id] = (t as any).name;

  const julyMap: Record<string, string[]> = {};
  const augustMap: Record<string, string[]> = {};
  for (const e of enrollments ?? []) {
    const c = (e as any).courses;
    if (!c || c.course_type === 'material') continue;
    const month = ((e as any).start_date ?? '').slice(5, 7);
    if (month === '07') {
      julyMap[(e as any).student_id] = [...(julyMap[(e as any).student_id] ?? []), c.name];
    } else if (month === '08') {
      augustMap[(e as any).student_id] = [...(augustMap[(e as any).student_id] ?? []), c.name];
    }
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

  const rows: EnrollmentRow[] = (students ?? []).map((s: any) => ({
    id: s.id,
    name: s.name ?? '—',
    grade: getGrade(s.enrollment_date),
    mainTutorId: s.main_tutor_id ?? '',
    mainTutorName: s.main_tutor_id ? (tutorMap[s.main_tutor_id] ?? '—') : '',
    julyEnrollments: julyMap[s.id] ?? [],
    augustEnrollments: augustMap[s.id] ?? [],
    leaves: leaveMap[s.id] ?? [],
    leaveNote: s.leave_note ?? null,
    registrationNote: s.registration_note ?? null,
  }));

  const tutorOptions = (teachers ?? []).map((t: any) => ({ id: t.id, name: t.name }));

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
