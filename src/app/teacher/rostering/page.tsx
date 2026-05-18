import { createSessionClient, createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getGrade } from '@/lib/grade';
import { getTeacherRosteringTabs, getTeacherAllowedCourses } from '@/actions/rostering-permissions';
import { getTeacherByUser } from '@/lib/get-teacher';
import RosteringMatrix, { type StudentRow, type ClassOption } from '@/components/classes/RosteringMatrix';
import CourseSelectorNav, { type CourseNavEntry } from '@/components/classes/CourseSelectorNav';
import InlineAddClassPanel from '@/components/classes/InlineAddClassPanel';
import Link from 'next/link';

const TABS = [
  { key: 'camp',    label: '冬夏令營 & 戶外教學', courseTypes: ['camp', 'trip'] },
  { key: 'english', label: '英語分班',             courseTypes: ['main_course'] },
] as const;

type TabKey = typeof TABS[number]['key'];

const COURSE_TYPE_TO_CATEGORY: Record<string, string> = {
  main_course: 'homeroom',
  camp: 'camp',
  trip: 'camp',
};

type CourseGroup = {
  value: string;
  label: string;
  courseIds: string[];
  totalCount: number;
  courseType: string;
};

function buildCourseGroups(
  courses: { id: string; name: string; course_type: string }[],
  enrollmentCounts: Record<string, number>
): CourseGroup[] {
  const map = new Map<string, { label: string; courseIds: string[]; courseType: string }>();
  for (const course of courses) {
    const match = course.name.match(/^(.+?)\s*[|｜]\s*(.+)$/);
    if (match) {
      const datePrefix = match[1].trim();
      const afterPipe = match[2].trim();
      const baseActivity = afterPipe.replace(/（[^）]*）$/, '').trim();
      const groupKey = `${datePrefix}||${baseActivity}`;
      if (!map.has(groupKey)) {
        map.set(groupKey, { label: `${datePrefix}｜${baseActivity}`, courseIds: [], courseType: course.course_type });
      }
      map.get(groupKey)!.courseIds.push(course.id);
    } else {
      map.set(`solo||${course.id}`, { label: course.name, courseIds: [course.id], courseType: course.course_type });
    }
  }
  return [...map.values()].map((g) => ({
    value: g.courseIds.join(','),
    label: g.label,
    courseIds: g.courseIds,
    totalCount: g.courseIds.reduce((sum, id) => sum + (enrollmentCounts[id] ?? 0), 0),
    courseType: g.courseType,
  }));
}

function TabNav({ permittedTabs, currentTab }: { permittedTabs: TabKey[]; currentTab: TabKey }) {
  if (permittedTabs.length <= 1) return null;
  return (
    <div className="flex border-b">
      {permittedTabs.map((key) => {
        const tab = TABS.find((t) => t.key === key)!;
        return (
          <Link
            key={key}
            href={`/teacher/rostering?tab=${key}`}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              currentTab === key
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

function CourseSelectPrompt({ groups, tab }: { groups: CourseGroup[]; tab: TabKey }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">請選擇課程開始分班</p>
      <div className="bg-background rounded-xl border shadow-sm divide-y">
        {groups.map((g) => (
          <Link
            key={g.value}
            href={`/teacher/rostering?tab=${tab}&courseIds=${encodeURIComponent(g.value)}`}
            className="flex items-center justify-between px-4 py-3 hover:bg-muted transition-colors text-sm first:rounded-t-xl last:rounded-b-xl"
          >
            <span className="font-medium">{g.label}</span>
            {g.totalCount > 0 && (
              <span className="text-xs text-muted-foreground">{g.totalCount} 人報名</span>
            )}
          </Link>
        ))}
        {groups.length === 0 && (
          <p className="px-4 py-3 text-sm text-muted-foreground">目前沒有可分班的課程。</p>
        )}
      </div>
    </div>
  );
}

export default async function TeacherRosteringPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; courseId?: string; courseIds?: string }>;
}) {
  // ── 驗證身份 ──
  const session = await createSessionClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) redirect('/login');

  const supabase = createServerClient();
  const selfTeacher = await getTeacherByUser(supabase, user.id, user.email, 'id, name');
  if (!selfTeacher) redirect('/');

  // ── 取得分班權限 ──
  const allowedTabs = await getTeacherRosteringTabs((selfTeacher as any).id);
  const permittedTabKeys = TABS.map((t) => t.key).filter((k) => allowedTabs.includes(k)) as TabKey[];

  if (permittedTabKeys.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground mt-12">
        您目前沒有分班管理的權限，請聯繫行政人員。
      </div>
    );
  }

  // ── 解析 URL params ──
  const params = await searchParams;
  const requestedTab = TABS.find((t) => t.key === params.tab)?.key;
  const currentTab: TabKey = (requestedTab && permittedTabKeys.includes(requestedTab as TabKey))
    ? requestedTab as TabKey
    : permittedTabKeys[0];

  const currentTabConfig = TABS.find((t) => t.key === currentTab)!;

  const courseIdList: string[] = params.courseIds
    ? params.courseIds.split(',').filter(Boolean)
    : params.courseId
    ? [params.courseId]
    : [];

  // ── 取課程清單 ──
  const [{ data: coursesData }, { data: allEnrollments }, allowedCourseIds] = await Promise.all([
    supabase
      .from('courses')
      .select('id, name, course_type')
      .in('course_type', currentTabConfig.courseTypes as unknown as string[])
      .order('name'),
    supabase.from('enrollments').select('course_id').eq('status', '生效'),
    getTeacherAllowedCourses((selfTeacher as any).id, currentTab),
  ]);

  const courses = (coursesData ?? []) as { id: string; name: string; course_type: string }[];
  const enrollmentCounts: Record<string, number> = {};
  for (const e of allEnrollments ?? []) {
    const cid = (e as any).course_id;
    if (cid) enrollmentCounts[cid] = (enrollmentCounts[cid] ?? 0) + 1;
  }
  const allGroups = buildCourseGroups(courses, enrollmentCounts);
  // null = 無課程限制，顯示全部；有值則只顯示被授權的群組
  const groups = allowedCourseIds === null
    ? allGroups
    : allGroups.filter((g) => g.courseIds.some((id) => allowedCourseIds.includes(id)));
  const navEntries: CourseNavEntry[] = groups.map((g) => ({ label: g.label, value: g.value }));

  // ── 尚未選課程 ──
  if (courseIdList.length === 0) {
    return (
      <div className="p-4 space-y-4 max-w-2xl">
        <h1 className="text-xl font-bold">分班管理</h1>
        <TabNav permittedTabs={permittedTabKeys} currentTab={currentTab} />
        <CourseSelectPrompt groups={groups} tab={currentTab} />
      </div>
    );
  }

  // ── 已選課程：取資料（驗證是否在授權範圍內）──
  const currentGroup = groups.find((g) => g.value === courseIdList.join(','))
    ?? groups.find((g) => g.courseIds.some((id) => courseIdList.includes(id)));

  // 若選到的課程不在授權範圍內，導回列表
  if (!currentGroup) redirect(`/teacher/rostering?tab=${currentTab}`);

  const courseCategory = COURSE_TYPE_TO_CATEGORY[currentGroup?.courseType ?? ''] ?? 'camp';
  const primaryCourseId = courseIdList[0];

  const [{ data: classesData }, { data: enrollments }, { data: teachersData }] = await Promise.all([
    supabase
      .from('classes')
      .select('id, name, teacher_id, teachers(name, english_name), class_students(count)')
      .in('course_id', courseIdList)
      .eq('status', 'active')
      .order('name'),
    supabase
      .from('enrollments')
      .select('student_id, students(id, name, english_name, enrollment_date, main_tutor_id, campus)')
      .in('course_id', courseIdList)
      .eq('status', '生效'),
    supabase
      .from('teachers')
      .select('id, name, english_name, department')
      .neq('status', '離職')
      .order('name'),
  ]);

  const teachers = (teachersData ?? []) as { id: string; name: string; english_name: string | null; department: string | null }[];
  const studentIds = [...new Set((enrollments ?? []).map((e: any) => e.student_id))];

  const tutorIds = [...new Set(
    (enrollments ?? []).map((e: any) => (e.students as any)?.main_tutor_id).filter(Boolean) as string[]
  )];
  const tutorMap: Record<string, string> = {};
  if (tutorIds.length > 0) {
    const { data: tutors } = await supabase.from('teachers').select('id, name, english_name').in('id', tutorIds);
    for (const t of tutors ?? []) {
      const name = (t as any).name as string;
      const en = (t as any).english_name as string | null;
      tutorMap[(t as any).id] = en ? `${en}（${name}）` : name;
    }
  }

  const classIds = (classesData ?? []).map((c: any) => c.id);

  const [{ data: currentAssignments }, { data: campEnrollments }] = await Promise.all([
    classIds.length > 0 && studentIds.length > 0
      ? supabase.from('class_students').select('class_id, student_id').in('class_id', classIds).in('student_id', studentIds)
      : { data: [] },
    studentIds.length > 0
      ? supabase.from('enrollments').select('student_id, courses(course_type)').in('student_id', studentIds).eq('status', '生效')
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
    .filter((e: any) => { if (seen.has(e.student_id)) return false; seen.add(e.student_id); return true; })
    .map((e: any) => {
      const s = e.students;
      return {
        id: s.id,
        name: s.name,
        englishName: s.english_name ?? null,
        grade: getGrade(s.enrollment_date),
        campus: s.campus ?? null,
        mainTutorName: tutorMap[s.main_tutor_id] ?? null,
        assignedClassId: assignmentMap[s.id] ?? null,
        isLocked: lockedStudentIds.has(s.id),
      };
    })
    .sort((a: StudentRow, b: StudentRow) => a.name.localeCompare(b.name, 'zh-TW'));

  const classes: ClassOption[] = (classesData ?? []).map((c: any) => {
    const t = c.teachers as { name: string; english_name: string | null } | null;
    return {
      id: c.id,
      name: c.name,
      capacity: null,
      enrolledCount: (c.class_students as any)?.[0]?.count ?? 0,
      teacherId: (c.teacher_id as string | null) ?? null,
      teacherName: t ? (t.english_name ? `${t.english_name}（${t.name}）` : t.name) : null,
    };
  });

  const pendingCount = rows.filter((r) => !r.assignedClassId).length;
  const currentNavValue = currentGroup?.value ?? courseIdList.join(',');

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">分班管理</h1>
        <div className="flex items-center gap-2">
          <CourseSelectorNav
            entries={navEntries}
            currentValue={currentNavValue}
            tab={currentTab}
            basePath="/teacher/rostering"
          />
        </div>
      </div>

      <TabNav permittedTabs={permittedTabKeys} currentTab={currentTab} />

      {currentGroup && (
        <p className="text-sm text-muted-foreground">
          {currentGroup.label}
          {rows.length > 0 && (
            <span className="ml-2">
              共 {rows.length} 人
              {pendingCount > 0 && (
                <span className="ml-1 text-amber-600 font-medium">・待分班 {pendingCount} 人</span>
              )}
            </span>
          )}
        </p>
      )}

      <InlineAddClassPanel
        courseId={primaryCourseId}
        courseCategory={courseCategory}
        teachers={teachers}
        existingClasses={classes.map((c) => ({ id: c.id, name: c.name, teacherId: c.teacherId }))}
      />

      {rows.length === 0 ? (
        <div className="bg-background rounded-xl border shadow-sm p-8 text-center text-sm text-muted-foreground">
          此課程目前沒有生效報名學生。
        </div>
      ) : classes.length === 0 ? (
        <div className="bg-background rounded-xl border shadow-sm p-8 text-center text-sm text-muted-foreground">
          請先使用上方「班級設定」建立班級，再進行分班。
        </div>
      ) : (
        <RosteringMatrix
          courseIds={courseIdList}
          courseName={currentGroup?.label ?? ''}
          initialRows={rows}
          classes={classes}
        />
      )}
    </div>
  );
}
