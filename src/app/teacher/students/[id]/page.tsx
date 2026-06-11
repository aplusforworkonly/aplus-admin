import { createSessionClient, createServerClient } from '@/lib/supabase/server';
import { getTeacherByUser } from '@/lib/get-teacher';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getStudentDailySchedule } from '@/actions/schedules';
import { StudentSchedulePanel } from '@/components/schedule/StudentSchedulePanel';

export default async function TeacherStudentSchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: studentId } = await params;

  const session = await createSessionClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) redirect('/login');

  const supabase = createServerClient();
  const selfTeacher = await getTeacherByUser(supabase, user.id, user.email, 'id, name, campus, is_supervisor');
  if (!selfTeacher) redirect('/');

  // 取得學生基本資料（含 main_tutor_id）
  const { data: student } = await supabase
    .from('students')
    .select('id, name, english_name, main_tutor_id')
    .eq('id', studentId)
    .eq('status', '就讀中')
    .single();

  if (!student) notFound();

  // 權限驗證：必須是該學生的總導師，或有該總導師存取權的督導
  const isTutor = student.main_tutor_id === (selfTeacher as any).id;
  let canAccess = isTutor;

  if (!canAccess && (selfTeacher as any).is_supervisor && student.main_tutor_id) {
    const { data: accessRow } = await supabase
      .from('supervisor_teacher_access')
      .select('viewable_teacher_id')
      .eq('supervisor_id', (selfTeacher as any).id)
      .eq('viewable_teacher_id', student.main_tutor_id)
      .maybeSingle();
    canAccess = !!accessRow;
  }

  if (!canAccess) notFound();

  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei' }).format(new Date());
  const initialSlots = await getStudentDailySchedule(studentId, today);

  return (
    <div className="min-h-screen flex items-start justify-center bg-muted/30 pt-6 px-4 pb-16">
      <div className="w-full max-w-lg space-y-4">
        <div>
          <Link href="/teacher/students" className="text-sm text-muted-foreground hover:text-foreground">
            ← 我的學生
          </Link>
          <h1 className="text-xl font-bold mt-1">{student.name} 的課表</h1>
          {student.english_name && (
            <p className="text-sm text-muted-foreground">{student.english_name}</p>
          )}
        </div>
        <div className="bg-background rounded-xl border shadow-sm p-4">
          <StudentSchedulePanel
            studentId={studentId}
            initialDate={today}
            initialSlots={initialSlots}
          />
        </div>
      </div>
    </div>
  );
}
