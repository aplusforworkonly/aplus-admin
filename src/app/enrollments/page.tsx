export const dynamic = 'force-dynamic';

import { createServerClient } from '@/lib/supabase/server';
import EnrollmentTable from '@/components/enrollments/EnrollmentTable';

export default async function EnrollmentsPage() {
  const supabase = createServerClient();

  const [
    { data: enrollments, error },
    { data: classes },
    { data: classStudents },
  ] = await Promise.all([
    supabase
      .from('enrollments')
      .select('id, contract_no, campus, start_date, end_date, status, student_id, students(name, english_name), courses(name)')
      .order('created_at', { ascending: false }),
    supabase
      .from('classes')
      .select('id, name, academic_year, term, teachers(name)')
      .eq('status', 'active')
      .order('name'),
    supabase
      .from('class_students')
      .select('class_id, student_id'),
  ]);

  if (error) throw new Error(error.message);

  const classOptions = (classes ?? []).map((c: any) => {
    const teacher = (c.teachers as any)?.name ? ` (${(c.teachers as any).name})` : '';
    const suffix = [c.academic_year, c.term].filter(Boolean).join(' ');
    const label = suffix ? `${c.name}（${suffix}）${teacher}` : `${c.name}${teacher}`;
    return { id: c.id, label };
  });

  const classStudentIds: Record<string, string[]> = {};
  for (const cs of classStudents ?? []) {
    const { class_id, student_id } = cs as any;
    if (!classStudentIds[class_id]) classStudentIds[class_id] = [];
    classStudentIds[class_id].push(student_id);
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">報名合約</h1>
      <EnrollmentTable
        enrollments={(enrollments ?? []) as any}
        classes={classOptions}
        classStudentIds={classStudentIds}
      />
    </div>
  );
}
