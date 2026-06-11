'use server';
import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import type { ScheduleSlot, AdminScheduleSlot } from '@/lib/supabase/types';

/**
 * 解析日期字串為本地 Date，避免 ISO 日期被當作 UTC 造成跨日偏移。
 * 例如：'2026-07-06' → new Date(2026, 6, 6) (local midnight)
 */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * 取得某學生在指定日期的課表。
 *
 * 策略：
 * 1. 用 class_students 找出學生所屬的所有班級（含 class_schedules）
 * 2. 用 enrollments 取得各課程的有效日期範圍
 * 3. 在記憶體內做 COALESCE 過濾（Supabase JS client 不支援鏈式 COALESCE）
 *    - valid_from  NULL → 用 enrollment.start_date
 *    - valid_until NULL → 用 enrollment.end_date（NULL 表示無限期）
 */
export async function getStudentDailySchedule(
  studentId: string,
  date: string // 'YYYY-MM-DD'
): Promise<ScheduleSlot[]> {
  const supabase = createServerClient();
  const dayOfWeek = parseLocalDate(date).getDay(); // 0=週日...6=週六

  // 1. 取得學生所屬班級（含課表時段）
  const { data: classStudents, error: csErr } = await supabase
    .from('class_students')
    .select(`
      classes!inner(
        id,
        name,
        campus,
        location,
        course_id,
        courses(name),
        class_schedules(id, day_of_week, start_time, end_time, valid_from, valid_until)
      )
    `)
    .eq('student_id', studentId);

  if (csErr) throw new Error(csErr.message);

  // 2. 取得學生所有生效報名（用於推算常規課程有效日期）
  const { data: enrollments, error: enErr } = await supabase
    .from('enrollments')
    .select('course_id, start_date, end_date')
    .eq('student_id', studentId)
    .eq('status', '生效');

  if (enErr) throw new Error(enErr.message);

  const enrollmentMap = new Map<string, { start_date: string; end_date: string | null }>(
    (enrollments ?? []).map((e) => [e.course_id, { start_date: e.start_date, end_date: e.end_date }])
  );

  // 3. 記憶體過濾：day_of_week 匹配 + COALESCE 日期區間
  const slots: ScheduleSlot[] = (classStudents ?? []).flatMap((cs) => {
    const cls = cs.classes as unknown as {
      id: string;
      name: string;
      campus: string;
      location: string | null;
      course_id: string | null;
      courses: { name: string } | null;
      class_schedules: Array<{
        id: string;
        day_of_week: number;
        start_time: string;
        end_time: string;
        valid_from: string | null;
        valid_until: string | null;
      }>;
    };

    if (!cls) return [];

    const enrollment = cls.course_id ? enrollmentMap.get(cls.course_id) : undefined;

    return (cls.class_schedules ?? [])
      .filter((sch) => {
        if (sch.day_of_week !== dayOfWeek) return false;

        const from  = sch.valid_from  ?? enrollment?.start_date ?? null;
        const until = sch.valid_until ?? enrollment?.end_date   ?? null;

        if (from && from > date) return false;
        if (until && until < date) return false;
        return true;
      })
      .map((sch) => ({
        class_id:    cls.id,
        class_name:  cls.name,
        course_name: cls.courses?.name ?? cls.name,
        start_time:  sch.start_time,
        end_time:    sch.end_time,
        campus:      cls.campus,
        location:    cls.location ?? null,
      }));
  });

  return slots.sort((a, b) => a.start_time.localeCompare(b.start_time));
}

/**
 * 取得學生某週（週一起算，共 5 天）的課表。
 * 並行呼叫 getStudentDailySchedule × 5，無額外 DB Round-trip。
 */
export async function getStudentWeeklySchedule(
  studentId: string,
  weekStart: string // 'YYYY-MM-DD' 週一
): Promise<{ date: string; slots: ScheduleSlot[] }[]> {
  const [y, m, d] = weekStart.split('-').map(Number);
  const dates = Array.from({ length: 5 }, (_, i) => {
    const dt = new Date(y, m - 1, d + i);
    return [
      dt.getFullYear(),
      String(dt.getMonth() + 1).padStart(2, '0'),
      String(dt.getDate()).padStart(2, '0'),
    ].join('-');
  });
  const results = await Promise.all(dates.map((date) => getStudentDailySchedule(studentId, date)));
  return dates.map((date, i) => ({ date, slots: results[i] }));
}

/**
 * 取得某班級的所有課程時段（Drawer 用，client-side fetch）。
 */
export async function getClassSchedules(classId: string): Promise<import('@/lib/supabase/types').ClassSchedule[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('class_schedules')
    .select('*')
    .eq('class_id', classId)
    .order('day_of_week')
    .order('start_time');
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * 新增某班級的一筆課程時段。
 *
 * 清洗規則：
 * - 空字串 valid_from / valid_until → null
 * - 時間補秒：'HH:MM' → 'HH:MM:SS'
 * - 時間倒置防禦：end_time <= start_time 拋錯
 * - 日期倒置防禦：valid_until < valid_from（兩者皆有值時）拋錯
 */
export async function createClassSchedule(
  classId: string,
  data: {
    day_of_week: number;
    start_time: string;
    end_time: string;
    valid_from: string | null;
    valid_until: string | null;
  }
): Promise<void> {
  const validFrom = data.valid_from || null;
  const validUntil = data.valid_until || null;
  const startTime = data.start_time.length === 5 ? data.start_time + ':00' : data.start_time;
  const endTime = data.end_time.length === 5 ? data.end_time + ':00' : data.end_time;

  if (endTime <= startTime) throw new Error('結束時間必須晚於開始時間');
  if (validFrom && validUntil && validUntil < validFrom) throw new Error('有效迄日必須晚於有效起日');

  const supabase = createServerClient();
  const { error } = await supabase.from('class_schedules').insert({
    class_id: classId,
    day_of_week: data.day_of_week,
    start_time: startTime,
    end_time: endTime,
    valid_from: validFrom,
    valid_until: validUntil,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/classes/${classId}`);
}

/**
 * 刪除一筆課程時段。
 * classId 直接由呼叫端傳入，action 內部不做額外查詢。
 */
export async function deleteClassSchedule(scheduleId: string, classId: string): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase.from('class_schedules').delete().eq('id', scheduleId);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/classes/${classId}`);
}

/**
 * 取得指定日期全校所有有排課的班級（行政總覽用）。
 * 透過 RPC `get_admin_daily_schedule` 在 DB 層做日期過濾，避免撈全表。
 */
export async function getAdminDailySchedule(
  date: string // 'YYYY-MM-DD'
): Promise<AdminScheduleSlot[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase.rpc('get_admin_daily_schedule', { p_date: date });
  if (error) throw new Error(error.message);

  return (data ?? []).map((row: {
    class_id: string;
    class_name: string;
    course_name: string;
    campus: string;
    start_time: string;
    end_time: string;
    enrolled_count: number;
  }) => ({
    class_id:      row.class_id,
    class_name:    row.class_name,
    course_name:   row.course_name,
    start_time:    row.start_time,
    end_time:      row.end_time,
    campus:        row.campus,
    enrolled_count: Number(row.enrolled_count),
  }));
}
