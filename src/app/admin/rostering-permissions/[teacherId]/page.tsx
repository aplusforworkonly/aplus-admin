import { createServerClient } from '@/lib/supabase/server';
import { toggleCoursePermission } from '@/actions/rostering-permissions';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';

const TABS = [
  { key: 'camp',    label: '冬夏令營 & 戶外教學', courseTypes: ['camp', 'trip'] },
  { key: 'english', label: '英語分班',             courseTypes: ['main_course'] },
] as const;

type CourseGroup = { label: string; courseIds: string[] };

function buildCourseGroups(courses: { id: string; name: string }[]): CourseGroup[] {
  const map = new Map<string, { label: string; courseIds: string[] }>();
  for (const course of courses) {
    const match = course.name.match(/^(.+?)\s*[|｜]\s*(.+)$/);
    if (match) {
      const datePrefix = match[1].trim();
      const baseActivity = match[2].trim().replace(/（[^）]*）$/, '').trim();
      const key = `${datePrefix}||${baseActivity}`;
      if (!map.has(key)) map.set(key, { label: `${datePrefix}｜${baseActivity}`, courseIds: [] });
      map.get(key)!.courseIds.push(course.id);
    } else {
      map.set(`solo||${course.id}`, { label: course.name, courseIds: [course.id] });
    }
  }
  return [...map.values()];
}

function CourseToggle({
  teacherId,
  tabKey,
  courseIds,
  enabled,
}: {
  teacherId: string;
  tabKey: string;
  courseIds: string[];
  enabled: boolean;
}) {
  async function toggle() {
    'use server';
    await toggleCoursePermission(teacherId, tabKey, courseIds, !enabled);
    revalidatePath(`/admin/rostering-permissions/${teacherId}`);
  }

  return (
    <form action={toggle}>
      <button
        type="submit"
        className={`w-10 h-6 rounded-full transition-colors relative ${
          enabled ? 'bg-primary' : 'bg-muted border border-input'
        }`}
        title={enabled ? '點擊取消此課程' : '點擊開放此課程'}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
            enabled ? 'left-[18px]' : 'left-0.5'
          }`}
        />
      </button>
    </form>
  );
}

export default async function TeacherPermissionDetailPage({
  params,
}: {
  params: Promise<{ teacherId: string }>;
}) {
  const { teacherId } = await params;
  const supabase = createServerClient();

  const [{ data: teacherData }, { data: tabPerms }, { data: coursePerms }] = await Promise.all([
    supabase.from('teachers').select('id, name, english_name, campus').eq('id', teacherId).single(),
    supabase.from('rostering_permissions').select('tab_key').eq('teacher_id', teacherId),
    supabase.from('rostering_course_permissions').select('tab_key, course_id').eq('teacher_id', teacherId),
  ]);

  if (!teacherData) {
    return <div className="p-6 text-sm text-muted-foreground">找不到老師。</div>;
  }

  const teacher = teacherData as { id: string; name: string; english_name: string | null; campus: string | null };
  const enabledTabKeys = new Set((tabPerms ?? []).map((p: any) => p.tab_key as string));
  const allowedCourseIds = new Set((coursePerms ?? []).map((p: any) => p.course_id as string));

  const enabledTabConfigs = TABS.filter((t) => enabledTabKeys.has(t.key));

  // 一次取完所有啟用分頁的課程
  const allCourseTypes = enabledTabConfigs.flatMap((t) => t.courseTypes as unknown as string[]);
  const { data: coursesData } = allCourseTypes.length > 0
    ? await supabase.from('courses').select('id, name, course_type').in('course_type', allCourseTypes).order('name')
    : { data: [] };

  const courses = (coursesData ?? []) as { id: string; name: string; course_type: string }[];

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <Link
        href="/admin/rostering-permissions"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← 返回權限設定列表
      </Link>

      <div>
        <h1 className="text-2xl font-bold">{teacher.name}</h1>
        {teacher.english_name && (
          <p className="text-sm text-muted-foreground">{teacher.english_name}</p>
        )}
        {teacher.campus && (
          <p className="text-sm text-muted-foreground">{teacher.campus}</p>
        )}
      </div>

      {enabledTabConfigs.length === 0 && (
        <p className="text-sm text-muted-foreground">此老師目前沒有任何分班分頁權限。</p>
      )}

      {enabledTabConfigs.map((tab) => {
        const tabCourses = courses.filter((c) =>
          (tab.courseTypes as readonly string[]).includes(c.course_type)
        );
        const groups = buildCourseGroups(tabCourses);
        const restrictedCount = groups.filter((g) =>
          g.courseIds.some((id) => allowedCourseIds.has(id))
        ).length;
        const hasRestrictions = restrictedCount > 0;

        return (
          <div key={tab.key} className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-base">{tab.label}</h2>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  hasRestrictions
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {hasRestrictions ? `僅限 ${restrictedCount} 個課程` : '所有課程'}
              </span>
            </div>

            <p className="text-xs text-muted-foreground">
              未指定任何課程時，預設開放此分頁的所有課程。
            </p>

            <div className="bg-background rounded-xl border shadow-sm divide-y">
              {groups.map((g) => {
                const isEnabled = g.courseIds.some((id) => allowedCourseIds.has(id));
                return (
                  <div
                    key={g.courseIds.join(',')}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <span className="text-sm">{g.label}</span>
                    <CourseToggle
                      teacherId={teacherId}
                      tabKey={tab.key}
                      courseIds={g.courseIds}
                      enabled={isEnabled}
                    />
                  </div>
                );
              })}
              {groups.length === 0 && (
                <p className="px-4 py-3 text-sm text-muted-foreground">此分頁目前沒有課程。</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
