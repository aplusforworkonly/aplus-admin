export const revalidate = 30;

import { createServerClient } from '@/lib/supabase/server';
import EnrollmentTable from '@/components/enrollments/EnrollmentTable';

export default async function EnrollmentsPage() {
  const supabase = createServerClient();

  const [
    { data: classes },
    { data: classStudents },
  ] = await Promise.all([
    supabase
      .from('classes')
      .select('id, name, academic_year, term, teachers(name)')
      .eq('status', 'active')
      .order('name'),
    supabase
      .from('class_students')
      .select('class_id, student_id'),
  ]);

  // 分頁撈完所有合約（Supabase 每次最多 1000 筆）
  const enrollments: any[] = [];
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from('enrollments')
      .select('id, contract_no, campus, start_date, end_date, status, student_id, students(name, english_name), courses(name, course_type)')
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    enrollments.push(...data);
    if (data.length < PAGE) break;
  }

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
        enrollments={(enrollments ?? []).filter((e: any) => e.courses?.course_type !== 'afternoon_basic') as any}
        classes={classOptions}
        classStudentIds={classStudentIds}
      />
    </div>
  );
}
