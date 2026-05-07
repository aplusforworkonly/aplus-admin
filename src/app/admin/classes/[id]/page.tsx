import { createServerClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import StudentAssignClassForm from '@/components/classes/StudentAssignClassForm';
import DeleteClassButton from '@/components/classes/DeleteClassButton';

const CATEGORY_LABELS: Record<string, string> = {
  homeroom: '教學班',
  english_core: '英語核心',
  elective: '選修',
};

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createServerClient();

  const { data: cls } = await supabase
    .from('classes')
    .select('*, teachers(name)')
    .eq('id', id)
    .single();

  if (!cls) notFound();

  const [{ data: allStudents }, { data: classStudents }, { data: enrollments }] =
    await Promise.all([
      supabase
        .from('students')
        .select('id, name, english_name, enrollment_date, status, campus')
        .order('name'),
      supabase.from('class_students').select('student_id').eq('class_id', id),
      cls.course_id
        ? supabase
            .from('enrollments')
            .select('student_id')
            .eq('course_id', cls.course_id)
            .eq('status', '生效')
        : Promise.resolve({ data: [] as { student_id: string }[] }),
    ]);

  const assignedIds = (classStudents ?? []).map((cs) => cs.student_id);
  const enrolledStudentIds = (enrollments ?? []).map((e) => e.student_id);

  return (
    <div className="p-6 max-w-xl space-y-6">
      <Link
        href="/admin/classes"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← 分班管理
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline">{CATEGORY_LABELS[cls.category] ?? cls.category}</Badge>
            {cls.program_track && <Badge variant="secondary">{cls.program_track}</Badge>}
          </div>
          <h1 className="text-2xl font-bold">{cls.name}</h1>
          <p className="text-sm text-muted-foreground">
            {cls.campus}
            {(cls.teachers as any)?.name
              ? `　負責老師：${(cls.teachers as any).name}`
              : '　尚未指定老師'}
          </p>
        </div>
        <DeleteClassButton id={id} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>分班名單</CardTitle>
        </CardHeader>
        <CardContent>
          <StudentAssignClassForm
            classId={id}
            allStudents={allStudents ?? []}
            assignedIds={assignedIds}
            enrolledStudentIds={enrolledStudentIds}
            hasCourse={!!cls.course_id}
          />
        </CardContent>
      </Card>
    </div>
  );
}
