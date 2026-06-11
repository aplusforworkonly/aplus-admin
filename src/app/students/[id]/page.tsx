import { createServerClient } from '@/lib/supabase/server';
import StudentForm from '@/components/students/StudentForm';
import LeavePanel from '@/components/students/LeavePanel';
import LeaveRequestsPanel from '@/components/students/LeaveRequestsPanel';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { StudentWithParents } from '@/lib/supabase/types';
import Link from 'next/link';
import { getStudentDailySchedule } from '@/actions/schedules';
import { StudentSchedulePanel } from '@/components/schedule/StudentSchedulePanel';

export default async function EditStudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createServerClient();
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei' }).format(new Date());

  const [{ data: student, error }, { data: leaves }, { data: teachers }, { data: leaveRequests }, initialSlots] = await Promise.all([
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
    supabase
      .from('leave_requests')
      .select('id, status, request_type, leave_date, leave_date_end, leave_type, reason, note, created_at, teacher_id, parent_id, teachers!teacher_id(name, english_name), parents(name)')
      .eq('student_id', id)
      .neq('request_type', '取消請假')
      .order('leave_date', { ascending: false })
      .limit(20),
    getStudentDailySchedule(id, today),
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
      <Card>
        <CardHeader>
          <CardTitle>請假申請</CardTitle>
        </CardHeader>
        <CardContent>
          <LeaveRequestsPanel requests={(leaveRequests ?? []) as any} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>每日課表</CardTitle>
        </CardHeader>
        <CardContent>
          <StudentSchedulePanel
            studentId={id}
            initialDate={today}
            initialSlots={initialSlots}
          />
        </CardContent>
      </Card>
    </div>
  );
}
