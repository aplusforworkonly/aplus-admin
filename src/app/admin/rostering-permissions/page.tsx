import { createServerClient } from '@/lib/supabase/server';
import { getAllRosteringPermissions, toggleRosteringPermission } from '@/actions/rostering-permissions';
import { revalidatePath } from 'next/cache';
import { Suspense } from 'react';
import Link from 'next/link';
import FilterBar from './FilterBar';
import SupervisorCell from '@/components/teachers/SupervisorCell';

const TABS = [
  { key: 'camp',    label: '冬夏令營 & 戶外教學' },
  { key: 'english', label: '英語分班' },
];

function PermissionToggle({
  teacherId,
  tabKey,
  enabled,
}: {
  teacherId: string;
  tabKey: string;
  enabled: boolean;
}) {
  async function toggle() {
    'use server';
    await toggleRosteringPermission(teacherId, tabKey, !enabled);
    revalidatePath('/admin/rostering-permissions');
  }

  return (
    <form action={toggle}>
      <button
        type="submit"
        className={`w-10 h-6 rounded-full transition-colors relative ${
          enabled ? 'bg-primary' : 'bg-muted border border-input'
        }`}
        title={enabled ? '點擊取消權限' : '點擊授予權限'}
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


export default async function RosteringPermissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ campus?: string; dept?: string }>;
}) {
  const params = await searchParams;
  const campusFilter = params.campus ?? '';
  const deptFilter = params.dept ?? '';

  const supabase = createServerClient();

  const [{ data: teachersData }, allPerms, { data: coursePermsData }] = await Promise.all([
    supabase
      .from('teachers')
      .select('id, name, english_name, campus, department, is_supervisor')
      .neq('status', '離職')
      .order('campus')
      .order('name'),
    getAllRosteringPermissions(),
    supabase.from('rostering_course_permissions').select('teacher_id').limit(1000),
  ]);

  const allTeachers = (teachersData ?? []) as {
    id: string;
    name: string;
    english_name: string | null;
    campus: string | null;
    department: string | null;
    is_supervisor: boolean | null;
  }[];

  const campuses = [...new Set(allTeachers.map((t) => t.campus).filter(Boolean) as string[])].sort();
  const departments = [...new Set(allTeachers.map((t) => t.department).filter(Boolean) as string[])].sort();

  const teachers = allTeachers.filter((t) => {
    if (campusFilter && t.campus !== campusFilter) return false;
    if (deptFilter && t.department !== deptFilter) return false;
    return true;
  });

  const permMap = new Map(allPerms.map((p) => [p.teacherId, new Set(p.tabs)]));
  const teachersWithCoursePerms = new Set(
    (coursePermsData ?? []).map((r: any) => r.teacher_id as string)
  );

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">分班管理權限設定</h1>
        <p className="text-sm text-muted-foreground mt-1">
          開啟後，老師可在老師入口看到對應的分班管理分頁並進行編輯。
        </p>
      </div>

      <Suspense fallback={null}>
        <FilterBar campuses={campuses} departments={departments} />
      </Suspense>

      <div className="bg-background rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="py-3 px-4 text-left font-medium text-muted-foreground">老師</th>
              {TABS.map((tab) => (
                <th key={tab.key} className="py-3 px-4 text-center font-medium text-muted-foreground w-40">
                  {tab.label}
                </th>
              ))}
              <th className="py-3 px-4 text-center font-medium text-muted-foreground w-28">
                督導權限
              </th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((teacher) => {
              const teacherTabs = permMap.get(teacher.id) ?? new Set<string>();
              return (
                <tr key={teacher.id} className="border-b last:border-0 hover:bg-muted/10">
                  <td className="py-3 px-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{teacher.name}</p>
                        {teacher.english_name && (
                          <p className="text-xs text-muted-foreground">{teacher.english_name}</p>
                        )}
                        {teacher.campus && (
                          <p className="text-xs text-muted-foreground">{teacher.campus}</p>
                        )}
                        {teachersWithCoursePerms.has(teacher.id) && (
                          <span className="text-xs text-amber-600 font-medium">有課程限制</span>
                        )}
                      </div>
                      {(permMap.get(teacher.id)?.size ?? 0) > 0 && (
                        <Link
                          href={`/admin/rostering-permissions/${teacher.id}`}
                          className="text-xs text-primary hover:underline whitespace-nowrap shrink-0"
                        >
                          詳細設定
                        </Link>
                      )}
                    </div>
                  </td>
                  {TABS.map((tab) => (
                    <td key={tab.key} className="py-3 px-4 text-center">
                      <div className="flex justify-center">
                        <PermissionToggle
                          teacherId={teacher.id}
                          tabKey={tab.key}
                          enabled={teacherTabs.has(tab.key)}
                        />
                      </div>
                    </td>
                  ))}
                  <td className="py-3 px-4 text-center">
                    <SupervisorCell
                      teacherId={teacher.id}
                      initial={teacher.is_supervisor ?? false}
                      allTeachers={allTeachers}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
