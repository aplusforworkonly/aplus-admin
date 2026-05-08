import { createServerClient } from '@/lib/supabase/server';
import { getGrade } from '@/lib/grade';
import RosteringMatrix, { type StudentRow, type ClassOption } from '@/components/classes/RosteringMatrix';
import CourseSelectorNav from '@/components/classes/CourseSelectorNav';
import Link from 'next/link';

function CourseSelectPrompt({ courses }: { courses: { id: string; name: string }[] }) {
  return (
    <div className="p-6 max-w-2xl space-y-4">
      <div>
        <Link href="/admin/classes" className="text-sm text-muted-foreground hover:text-foreground">
          ← 分班管理
        </Link>
        <h1 className="text-2xl font-bold mt-1">分班矩陣</h1>
        <p className="text-sm text-muted-foreground mt-1">請先選擇課程</p>
      </div>
      <div className="bg-background rounded-xl border shadow-sm p-6 space-y-3">
        {courses.map((c) => (
          <Link
            key={c.id}
            href={`/admin/classes/matrix?courseId=${c.id}`}
            className="block px-4 py-3 rounded-lg border hover:bg-muted transition-colors text-sm font-medium"
          >
            {c.name}
          </Link>
        ))}
        {courses.length === 0 && (
          <p className="text-sm text-muted-foreground">目前沒有可分班的課程。</p>
        )}
      </div>
    </div>
  );
}

export default async function RosteringMatrixPage({
  searchParams,
}: {
  searchParams: Promise<{ courseId?: string }>;
}) {
  const { courseId } = await searchParams;
  const supabase = createServerClient();

  const { data: coursesData } = await supabase
    .from('courses')
    .select('id, name, course_type')
    .neq('course_type', 'material')
    .order('name');

  const courses = (coursesData ?? []) as { id: string; name: string; course_type: string }[];

  if (!courseId) {
    return <CourseSelectPrompt courses={courses} />;
  }

  const currentCourse = courses.find((c) => c.id === courseId);

  const [{ data: classesData }, { data: enrollments }] = await Promise.all([
    supabase
      .from('classes')
      .select('id, name, class_students(count)')
      .eq('course_id', courseId)
      .eq('status', 'active')
      .order('name'),
    supabase
      .from('enrollments')
      .select('student_id, students(id, name, english_name, enrollment_date, main_tutor_id, teachers(name))')
      .eq('course_id', courseId)
      .eq('status', '生效'),
  ]);

  const studentIds = [...new Set((enrollments ?? []).map((e: any) => e.student_id))];
  const classIds = (classesData ?? []).map((c: any) => c.id);

  const [{ data: currentAssignments }, { data: campEnrollments }] = await Promise.all([
    classIds.length > 0 && studentIds.length > 0
      ? supabase
          .from('class_students')
          .select('class_id, student_id')
          .in('class_id', classIds)
          .in('student_id', studentIds)
      : { data: [] },
    studentIds.length > 0
      ? supabase
          .from('enrollments')
          .select('student_id, courses(course_type)')
          .in('student_id', studentIds)
          .eq('status', '生效')
      : { data: [] },
  ]);

  const lockedStudentIds = new Set(
    (campEnrollments ?? [])
      .filter((e: any) => e.courses?.course_type === 'camp')
      .map((e: any) => e.student_id)
  );

  const assignmentMap: Record<string, string> = {};
  for (const a of currentAssignments ?? []) {
    assignmentMap[(a as any).student_id] = (a as any).class_id;
  }

  const seen = new Set<string>();
  const rows: StudentRow[] = (enrollments ?? [])
    .filter((e: any) => {
      if (seen.has(e.student_id)) return false;
      seen.add(e.student_id);
      return true;
    })
    .map((e: any) => {
      const s = e.students;
      return {
        id: s.id,
        name: s.name,
        englishName: s.english_name ?? null,
        grade: getGrade(s.enrollment_date),
        mainTutorName: (s.teachers as any)?.name ?? null,
        assignedClassId: assignmentMap[s.id] ?? null,
        isLocked: lockedStudentIds.has(s.id),
      };
    })
    .sort((a: StudentRow, b: StudentRow) => a.name.localeCompare(b.name, 'zh-TW'));

  const classes: ClassOption[] = (classesData ?? []).map((c: any) => ({
    id: c.id,
    name: c.name,
    capacity: null,
    enrolledCount: (c.class_students as any)?.[0]?.count ?? 0,
  }));

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/classes" className="text-sm text-muted-foreground hover:text-foreground">
            ← 分班管理
          </Link>
          <h1 className="text-2xl font-bold mt-1">分班矩陣</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">課程：</span>
          <CourseSelectorNav courses={courses} currentCourseId={courseId} />
        </div>
      </div>

      {classes.length === 0 ? (
        <div className="bg-background rounded-xl border shadow-sm p-8 text-center text-sm text-muted-foreground">
          此課程目前沒有 active 班級，請先至分班管理建立班級。
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-background rounded-xl border shadow-sm p-8 text-center text-sm text-muted-foreground">
          此課程目前沒有生效報名學生。
        </div>
      ) : (
        <RosteringMatrix
          courseId={courseId}
          courseName={currentCourse?.name ?? ''}
          initialRows={rows}
          classes={classes}
        />
      )}
    </div>
  );
}
