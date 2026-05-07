import { createServerClient } from '@/lib/supabase/server';
import StudentForm from '@/components/students/StudentForm';
import LeavePanel from '@/components/students/LeavePanel';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { StudentWithParents } from '@/lib/supabase/types';
import Link from 'next/link';

export default async function EditStudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createServerClient();

  const [{ data: student, error }, { data: leaves }, { data: teachers }] = await Promise.all([
    supabase
      .from('students')
      .select(`*, parent_student_mapping(id, relationship, parents(id, name, phone, email, line_id))`)
      .eq('id', id)
      .single(),
    supabase
      .from('student_leaves')
      .select('*')
      .eq('student_id', id)
      .order('leave_date'),
    supabase
      .from('teachers')
      .select('id, name, english_name, department')
      .neq('status', '離職')
      .order('name'),
  ]);

  if (error || !student) notFound();

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <Link href="/students" className="text-sm text-muted-foreground hover:text-foreground">
          ← 學生管理
        </Link>
        <h1 className="text-2xl font-bold mt-1">編輯：{student.name}</h1>
      </div>
      <StudentForm student={student as StudentWithParents} teachers={(teachers ?? []) as any} />
      <Card>
        <CardHeader>
          <CardTitle>請假紀錄</CardTitle>
        </CardHeader>
        <CardContent>
          <LeavePanel studentId={id} leaves={leaves ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
