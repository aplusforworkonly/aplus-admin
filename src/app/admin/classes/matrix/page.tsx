export const dynamic = 'force-dynamic';

import { createServerClient } from '@/lib/supabase/server';
import { getGrade } from '@/lib/grade';
import RosteringMatrix, { type StudentRow, type ClassOption } from '@/components/classes/RosteringMatrix';
import CourseSelectorNav, { type CourseNavEntry } from '@/components/classes/CourseSelectorNav';
import InlineAddClassPanel from '@/components/classes/InlineAddClassPanel';
import GenerateAfternoonBasicButton from '@/components/classes/GenerateAfternoonBasicButton';
import Link from 'next/link';

// ── 分頁設定 ──────────────────────────────────────────────────────
const TABS = [
  { key: 'camp',    label: '冬夏令營 & 戶外教學', courseTypes: ['camp', 'trip', 'afternoon_basic'] },
  { key: 'english', label: '英語分班',             courseTypes: ['main_course'] },
] as const;

type TabKey = typeof TABS[number]['key'];

const COURSE_TYPE_TO_CATEGORY: Record<string, string> = {
  main_course: 'homeroom',
  camp: 'camp',
  trip: 'camp',
  afternoon_basic: 'camp',
};

// ── 課程分組邏輯（依「日期｜活動」合併） ─────────────────────────
type CourseGroup = {
  value: string;
  label: string;
  courseIds: string[];
  totalCount: number;
  courseType: string;
};

const TYPE_SORT_PRIORITY: Record<string, number> = { camp: 0, afternoon_basic: 1, trip: 2 };

function parseDateSortKey(label: string): number {
  const prefix = label.split(/[｜|]/)[0].trim();
  const base = prefix.split('–')[0].trim();
  const parts = base.split('/').map((s) => parseInt(s, 10));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return parts[0] * 100 + parts[1];
  }
  return 9999;
}

function buildCourseGroups(
  courses: { id: string; name: string; course_type: string }[],
  countByCourse: Record<string, number>
): CourseGroup[] {
  const map = new Map<string, { label: string; courseIds: string[]; courseType: string; totalCount: number }>();

  for (const course of courses) {
    const match = course.name.match(/^(.+?)\s*[|｜]\s*(.+)$/);
    let groupKey: string;
    let groupLabel: string;

    if (match) {
      const datePrefix = match[1].trim();
      const afterPipe = match[2].trim();
      const baseActivity = afterPipe.replace(/（[^）]*）$/, '').trim();
      groupKey = `${datePrefix}||${baseActivity}`;
      groupLabel = `${datePrefix}｜${baseActivity}`;
    } else {
      if (course.course_type === 'main_course') {
        const baseName = course.name.replace(/^[0-9]+月/, '').trim();
        groupKey = `main_course||${baseName}`;
        groupLabel = baseName;
      } else {
        groupKey = `solo||${course.id}`;
        groupLabel = course.name;
      }
    }

    if (!map.has(groupKey)) {
      map.set(groupKey, { label: groupLabel, courseIds: [], courseType: course.course_type, totalCount: 0 });
    }
    const entry = map.get(groupKey)!;
    entry.courseIds.push(course.id);
    entry.totalCount += countByCourse[course.id] ?? 0;
  }

  return [...map.values()]
    .map((g) => ({
      value: g.courseIds.join(','),
      label: g.label,
      courseIds: g.courseIds,
      totalCount: g.totalCount,
      courseType: g.courseType,
    }))
    .sort((a, b) => {
      const typeA = TYPE_SORT_PRIORITY[a.courseType] ?? 5;
      const typeB = TYPE_SORT_PRIORITY[b.courseType] ?? 5;
      if (typeA !== typeB) return typeA - typeB;
      const dateA = parseDateSortKey(a.label);
      const dateB = parseDateSortKey(b.label);
      if (dateA !== dateB) return dateA - dateB;
      return a.label.localeCompare(b.label, 'zh');
    });
}

// ── Tab 導航（Server Component，Link-based） ──────────────────────
function TabNav({ currentTab }: { currentTab: TabKey }) {
  return (
    <div className="flex border-b">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={`/admin/classes/matrix?tab=${tab.key}`}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            currentTab === tab.key
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

// ── 課程選擇畫面 ──────────────────────────────────────────────────
function CourseSelectPrompt({ groups, tab }: { groups: CourseGroup[]; tab: TabKey }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">請選擇課程開始分班</p>
      <div className="bg-background rounded-xl border shadow-sm divide-y">
        {groups.map((g) => (
          <Link
            key={g.value}
            href={`/admin/classes/matrix?tab=${tab}&courseIds=${encodeURIComponent(g.value)}`}
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

// ── 主頁面 ────────────────────────────────────────────────────────
export default async function RosteringMatrixPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; courseId?: string; courseIds?: string }>;
}) {
  const params = await searchParams;

  const currentTab: TabKey =
    TABS.find((t) => t.key === params.tab)?.key ?? 'camp';
  const currentTabConfig = TABS.find((t) => t.key === currentTab)!;

  const courseIdList: string[] = params.courseIds
    ? params.courseIds.split(',').filter(Boolean)
    : params.courseId
    ? [params.courseId]
    : [];

  const supabase = createServerClient();

  const { data: coursesData } = await supabase
    .from('courses')
    .select('id, name, course_type')
    .in('course_type', currentTabConfig.courseTypes as unknown as string[])
    .order('name');

  const courses = (coursesData ?? []) as { id: string; name: string; course_type: string }[];
  const tabCourseIds = courses.map((c) => c.id);

  const countByCourse: Record<string, number> = {};
  if (tabCourseIds.length > 0) {
    const countResults = await Promise.all(
      tabCourseIds.map(async (courseId) => {
        const { count } = await supabase
          .from('enrollments')
          .select('student_id', { count: 'exact', head: true })
          .eq('course_id', courseId)
          .eq('status', '生效');
        return [courseId, count ?? 0] as const;
      })
    );
    for (const [courseId, count] of countResults) {
      countByCourse[courseId] = count;
    }
  }

  const groups = buildCourseGroups(courses, countByCourse);

  const navEntries: CourseNavEntry[] = groups.map((g) => ({
    label: g.label,
    value: g.value,
  }));

  // ── 尚未選課程 → 顯示課程清單 ──
  if (courseIdList.length === 0) {
    return (
      <div className="p-6 space-y-4 max-w-2xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">分班管理</h1>
          {currentTab === 'camp' && <GenerateAfternoonBasicButton />}
        </div>
        <TabNav currentTab={currentTab} />
        <CourseSelectPrompt groups={groups} tab={currentTab} />
      </div>
    );
  }

  // ── 已選課程 → 取資料 ──
  const currentGroup = groups.find((g) => g.value === courseIdList.join(','))
    ?? groups.find((g) => g.courseIds.some((id) => courseIdList.includes(id)));

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

  const totalCount = rows.length;
  const currentNavValue = currentGroup?.value ?? courseIdList.join(',');

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">分班管理</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">課程：</span>
          <CourseSelectorNav entries={navEntries} currentValue={currentNavValue} tab={currentTab} />
        </div>
      </div>

      <TabNav currentTab={currentTab} />

      {currentGroup && (
        <p className="text-sm text-muted-foreground">
          {currentGroup.label}
          {totalCount > 0 && (
            <span className="ml-2">
              共 {totalCount} 人
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
