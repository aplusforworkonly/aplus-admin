'use server';
import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';

export async function approveStudentReview(id: string) {
  const supabase = createServerClient();

  const { data: review, error } = await supabase
    .from('student_review_requests')
    .select('student_id, proposed_changes')
    .eq('id', id)
    .single();

  if (error || !review) throw new Error('找不到審核資料');

  const changes = review.proposed_changes as Record<string, { old: unknown; new: unknown }>;
  const updates: Record<string, unknown> = {};
  for (const [field, diff] of Object.entries(changes)) {
    updates[field] = diff.new;
  }

  const { error: updateErr } = await supabase
    .from('students')
    .update(updates)
    .eq('id', review.student_id);

  if (updateErr) throw new Error('更新學生資料失敗：' + updateErr.message);

  await supabase
    .from('student_review_requests')
    .update({ status: 'approved', resolved_at: new Date().toISOString() })
    .eq('id', id);

  revalidatePath('/admin/student-reviews');
}

export async function rejectStudentReview(id: string) {
  const supabase = createServerClient();

  await supabase
    .from('student_review_requests')
    .update({ status: 'rejected', resolved_at: new Date().toISOString() })
    .eq('id', id);

  revalidatePath('/admin/student-reviews');
}

export async function mergeStudents(
  keepId: string,
  deleteId: string,
  fieldOverrides?: Record<string, string>,
  skipMappingIds?: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createServerClient();

  try {
    // parent_student_mapping has UNIQUE(parent_id, student_id) — handle conflicts manually
    const [{ data: deleteMappings, error: e1 }, { data: keepMappings, error: e2 }] = await Promise.all([
      supabase.from('parent_student_mapping').select('id, parent_id').eq('student_id', deleteId),
      supabase.from('parent_student_mapping').select('parent_id').eq('student_id', keepId),
    ]);
    if (e1) throw new Error('讀取家長關係失敗：' + e1.message);
    if (e2) throw new Error('讀取保留學生家長失敗：' + e2.message);

    const keepParentIds = new Set((keepMappings ?? []).map((m) => m.parent_id));
    const skipSet = new Set(skipMappingIds ?? []);

    for (const m of deleteMappings ?? []) {
      if (skipSet.has(m.id) || keepParentIds.has(m.parent_id)) {
        const { error } = await supabase.from('parent_student_mapping').delete().eq('id', m.id);
        if (error) throw new Error(`刪除家長關係失敗（${m.id}）：` + error.message);
      } else {
        const { error } = await supabase.from('parent_student_mapping').update({ student_id: keepId }).eq('id', m.id);
        if (error) throw new Error(`轉移家長關係失敗（${m.id}）：` + error.message);
      }
    }

    // Transfer enrollments — guard_enrollment trigger resets status, so restore it after
    const { data: enrollmentRows, error: eEnroll } = await supabase
      .from('enrollments')
      .select('id, status')
      .eq('student_id', deleteId);
    if (eEnroll) throw new Error('讀取報名資料失敗：' + eEnroll.message);

    for (const row of enrollmentRows ?? []) {
      const { error: e } = await supabase.from('enrollments').update({ student_id: keepId }).eq('id', row.id);
      if (e) throw new Error(`轉移報名失敗（${row.id}）：` + e.message);
      // Restore status that guard_enrollment trigger may have reset
      const { error: e2 } = await supabase.from('enrollments').update({ status: row.status }).eq('id', row.id);
      if (e2) throw new Error(`還原報名狀態失敗（${row.id}）：` + e2.message);
    }

    // Transfer remaining FK references
    for (const table of ['invoices', 'student_credits', 'class_students', 'leave_requests', 'student_review_requests'] as const) {
      const { error } = await supabase.from(table).update({ student_id: keepId } as never).eq('student_id', deleteId);
      if (error) throw new Error(`轉移 ${table} 失敗：` + error.message);
    }

    // Apply field overrides to the kept student.
    // Unique fields (e.g. id_number) must be cleared from deleted student first to avoid constraint violation.
    if (fieldOverrides && Object.keys(fieldOverrides).length > 0) {
      const clearFields = Object.fromEntries(Object.keys(fieldOverrides).map((k) => [k, null]));
      const { error: eClear } = await supabase.from('students').update(clearFields).eq('id', deleteId);
      if (eClear) throw new Error('清除重複欄位失敗：' + eClear.message);

      const { error } = await supabase.from('students').update(fieldOverrides).eq('id', keepId);
      if (error) throw new Error('更新保留學生欄位失敗：' + error.message);
    }

    // Mark the duplicate as merged (distinct from real departed students)
    const { error: eDel } = await supabase.from('students').update({ status: '重複建檔' }).eq('id', deleteId);
    if (eDel) throw new Error('軟刪除重複學生失敗：' + eDel.message);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[mergeStudents]', msg);
    return { ok: false, error: msg };
  }

  revalidatePath('/admin/student-reviews');
  revalidatePath('/admin/roster');
  return { ok: true };
}
