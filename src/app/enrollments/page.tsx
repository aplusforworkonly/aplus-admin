import { Suspense } from 'react';
import { createServerClient } from '@/lib/supabase/server';
import EnrollmentTable from '@/components/enrollments/EnrollmentTable';

const PAGE_SIZE = 100;
const DEFAULT_STATUSES = ['生效', '待審核', '候補'];
const ALL_STATUSES = ['生效', '待審核', '候補', '退班', '已結業'];

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function EnrollmentsPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? '1'));
  const offset = (page - 1) * PAGE_SIZE;

  const statuses = params.status === 'all' ? ALL_STATUSES : (params.status?.split(',') ?? DEFAULT_STATUSES);
  const campus = params.campus && params.campus !== 'all' ? params.campus : null;

  const supabase = createServerClient();

  let enrollmentQuery = supabase
    .from('enrollments')
    .select(
      'id, contract_no, campus, start_date, end_date, status, student_id, students(name, english_name), courses(name, course_type)',
      { count: 'exact' }
    )
    .in('status', statuses)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (campus) enrollmentQuery = (enrollmentQuery as any).eq('campus', campus);

  const [
    { data: classes },
    { data: classStudents },
    { data: enrollmentsRaw, count },
  ] = await Promise.all([
    supabase.from('classes').select('id, name, academic_year, term, teachers(name)').eq('status', 'active').order('name'),
    supabase.from('class_students').select('class_id, student_id'),
    enrollmentQuery,
  ]);

  const enrollments = (enrollmentsRaw ?? []).filter(
    (e: any) => e.courses?.course_type !== 'afternoon_basic'
  );

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
      <Suspense>
        <EnrollmentTable
          enrollments={enrollments as any}
          classes={classOptions}
          classStudentIds={classStudentIds}
          totalCount={count ?? 0}
          currentPage={page}
          pageSize={PAGE_SIZE}
        />
      </Suspense>
    </div>
  );
}
