'use server';
import { createServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

const PERIODS = [
  { courseName: '7/6–7/16｜下午基本',  campName: '化石生態營', fullDayCourse: '7月夏令營全日基本課程', startDate: '2026-07-06' },
  { courseName: '7/20–7/30｜下午基本', campName: '玩具製作營', fullDayCourse: '7月夏令營全日基本課程', startDate: '2026-07-20' },
  { courseName: '8/3–8/13｜下午基本',  campName: '美學手作營', fullDayCourse: '8月夏令營全日基本課程', startDate: '2026-08-03' },
  { courseName: '8/17–8/27｜下午基本', campName: '自然電路營', fullDayCourse: '8月夏令營全日基本課程', startDate: '2026-08-17' },
];

export async function generateAfternoonBasicEnrollments() {
  const supabase = createServerClient();

  const allCourseNames = [
    ...PERIODS.map((p) => p.campName),
    ...PERIODS.map((p) => p.fullDayCourse),
    ...PERIODS.map((p) => p.courseName),
  ];
  const { data: courses } = await supabase.from('courses').select('id, name').in('name', allCourseNames);
  const courseMap: Record<string, string> = {};
  for (const c of courses ?? []) courseMap[c.name] = c.id;

  let added = 0;
  let removed = 0;

  for (const period of PERIODS) {
    const afternoonCourseId = courseMap[period.courseName];
    const fullDayCourseId = courseMap[period.fullDayCourse];
    const campCourseId = courseMap[period.campName];
    if (!afternoonCourseId || !fullDayCourseId || !campCourseId) continue;

    const [{ data: fullDayEnrollments }, { data: campEnrollments }] = await Promise.all([
      supabase.from('enrollments').select('student_id, campus').eq('course_id', fullDayCourseId).eq('status', '生效'),
      supabase.from('enrollments').select('student_id').eq('course_id', campCourseId).eq('status', '生效'),
    ]);

    const campStudentIds = new Set((campEnrollments ?? []).map((e) => e.student_id));
    const targetMap: Record<string, string> = {};
    for (const e of fullDayEnrollments ?? []) {
      if (!campStudentIds.has(e.student_id)) targetMap[e.student_id] = e.campus;
    }
    const targetIds = new Set(Object.keys(targetMap));

    const { data: currentEnrollments } = await supabase
      .from('enrollments')
      .select('id, student_id')
      .eq('course_id', afternoonCourseId)
      .eq('start_date', period.startDate)
      .eq('status', '生效');

    const currentMap: Record<string, string> = {};
    for (const e of currentEnrollments ?? []) currentMap[e.student_id] = e.id;
    const currentIds = new Set(Object.keys(currentMap));

    const toAdd = [...targetIds].filter((id) => !currentIds.has(id));
    if (toAdd.length > 0) {
      const { error: insertErr } = await supabase.from('enrollments').insert(
        toAdd.map((studentId) => ({
          student_id: studentId,
          course_id: afternoonCourseId,
          campus: targetMap[studentId],
          start_date: period.startDate,
          status: '生效',
          contract_no: `AB-${period.startDate}-${studentId.slice(0, 8)}`,
        }))
      );
      if (insertErr) throw new Error(`${period.courseName}: ${insertErr.message}`);
      added += toAdd.length;
    }

    const toRemove = [...currentIds].filter((id) => !targetIds.has(id));
    if (toRemove.length > 0) {
      const removeEnrollmentIds = toRemove.map((id) => currentMap[id]);
      await supabase.from('enrollments').delete().in('id', removeEnrollmentIds);
      removed += toRemove.length;
    }
  }

  revalidatePath('/admin/classes');
  return { added, removed };
}
