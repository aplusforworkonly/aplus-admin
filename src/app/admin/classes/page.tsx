import { createServerClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/badge';
import AddClassForm from '@/components/classes/AddClassForm';
import ClassFilters from '@/components/classes/ClassFilters';
import ClassRowActions from '@/components/classes/ClassRowActions';
import BatchImportButton from '@/components/classes/BatchImportButton';
import BatchCreateClassesButton from '@/components/classes/BatchCreateClassesButton';
import BatchDeleteClassesButton from '@/components/classes/BatchDeleteClassesButton';
import UndoBanner from '@/components/classes/UndoBanner';
import { Suspense } from 'react';

const CATEGORY_LABELS: Record<string, string> = {
  homeroom: '教學班',
  english_core: '英語核心',
  elective: '選修',
};

const CATEGORY_ORDER = ['homeroom', 'english_core', 'elective'];

export default async function AdminClassesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; year?: string; term?: string }>;
}) {
  const { tab, year, term } = await searchParams;
  const isArchived = tab === 'archived';

  const supabase = createServerClient();

  let query = supabase
    .from('classes')
    .select('id, name, campus, category, program_track, course_id, teacher_id, academic_year, term, status, teachers(name, english_name), class_students(student_id)')
    .eq('status', isArchived ? 'archived' : 'active')
    .order('name');

  if (year) query = query.eq('academic_year', year);
  if (term) query = query.eq('term', term);

  const [{ data: classes }, { data: teachers }, { data: courses }, { data: allYearsRaw }, { data: activeEnrollments }] =
    await Promise.all([
      query,
      supabase.from('teachers').select('id, name, english_name, department').order('name'),
      supabase.from('courses').select('id, name').order('name'),
      supabase.from('classes').select('academic_year').not('academic_year', 'is', null),
      supabase.from('enrollments').select('course_id, student_id').eq('status', '生效'),
    ]);

  const years = [...new Set((allYearsRaw ?? []).map((r) => r.academic_year).filter(Boolean) as string[])].sort().reverse();

  // 全局比對：同一 course_id 底下所有班級的已分配學生合併為一個 Set
  const assignedByCourse = new Map<string, Set<string>>();
  for (const c of classes ?? []) {
    const courseId = (c as any).course_id as string | null;
    if (!courseId) continue;
    if (!assignedByCourse.has(courseId)) assignedByCourse.set(courseId, new Set());
    for (const cs of (c.class_students as any[]) ?? []) {
      assignedByCourse.get(courseId)!.add(cs.student_id);
    }
  }

  // 報名總名單：course_id → 已報名學生 Set
  const enrolledByCourse = new Map<string, Set<string>>();
  for (const e of activeEnrollments ?? []) {
    if (!e.course_id) continue;
    if (!enrolledByCourse.has(e.course_id)) enrolledByCourse.set(e.course_id, new Set());
    enrolledByCourse.get(e.course_id)!.add(e.student_id);
  }

  // 每個 course_id 真正待分班人數（報名但不在任何相關班級）
  const pendingByCourse = new Map<string, number>();
  for (const [courseId, enrolled] of enrolledByCourse) {
    const assigned = assignedByCourse.get(courseId) ?? new Set();
    pendingByCourse.set(courseId, [...enrolled].filter((id) => !assigned.has(id)).length);
  }

  const grouped = CATEGORY_ORDER.reduce<Record<string, any[]>>((acc, cat) => {
    acc[cat] = (classes ?? []).filter((c) => c.category === cat);
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">分班管理</h1>
        <div className="flex gap-2">
          <BatchCreateClassesButton teachers={teachers ?? []} />
          <BatchImportButton />
          <BatchDeleteClassesButton
            classes={(classes ?? []).map((c) => ({
              id: c.id,
              name: c.name,
              campus: c.campus,
              category: c.category,
              academic_year: c.academic_year,
              term: c.term,
              student_count: (c.class_students as any[])?.length ?? 0,
            }))}
          />
        </div>
      </div>

      <UndoBanner />

      <div className="rounded-xl border bg-background p-5">
        <p className="text-sm font-medium mb-4">新增班級</p>
        <AddClassForm teachers={teachers ?? []} courses={courses ?? []} />
      </div>

      <Suspense>
        <ClassFilters years={years} />
      </Suspense>

      {CATEGORY_ORDER.map((cat) => {
        const list = grouped[cat] ?? [];
        return (
          <div key={cat}>
            <h2 className="text-base font-semibold mb-3">{CATEGORY_LABELS[cat]}</h2>
            {list.length === 0 ? (
              <p className="text-sm text-muted-foreground">尚無班級</p>
            ) : (
              <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">班級名稱</th>
                      <th className="text-left px-4 py-2 font-medium">校區</th>
                      <th className="text-left px-4 py-2 font-medium">負責老師</th>
                      {cat === 'english_core' && (
                        <th className="text-left px-4 py-2 font-medium">大班系</th>
                      )}
                      <th className="text-left px-4 py-2 font-medium">學年度 / 學期</th>
                      <th className="px-4 py-2 font-medium text-right">學生數</th>
                      <th className="w-40"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((c) => {
                      const studentCount = (c.class_students as any[])?.length ?? 0;
                      const courseId = (c as any).course_id as string | null;
                      const pendingCount = courseId ? (pendingByCourse.get(courseId) ?? 0) : 0;
                      return (
                        <tr key={c.id} className="border-t hover:bg-muted/30">
                          <td className="px-4 py-2 font-medium">{c.name}</td>
                          <td className="px-4 py-2 text-muted-foreground">{c.campus}</td>
                          <td className="px-4 py-2">
                            {(c.teachers as any)?.name
                              ? <>{(c.teachers as any).name}{(c.teachers as any).english_name && <span className="text-muted-foreground ml-1">/ {(c.teachers as any).english_name}</span>}</>
                              : '—'}
                          </td>
                          {cat === 'english_core' && (
                            <td className="px-4 py-2">
                              {c.program_track
                                ? <Badge variant="outline">{c.program_track}</Badge>
                                : '—'}
                            </td>
                          )}
                          <td className="px-4 py-2 text-muted-foreground">
                            {c.academic_year || c.term
                              ? [c.academic_year, c.term].filter(Boolean).join(' ')
                              : '—'}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {pendingCount > 0 && (
                                <span className="text-xs px-1.5 py-0.5 rounded border bg-orange-50 text-orange-700 border-orange-200">
                                  待分班 {pendingCount}
                                </span>
                              )}
                              {studentCount}
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <ClassRowActions
                              cls={{ ...c, student_count: studentCount }}
                              teachers={teachers ?? []}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
