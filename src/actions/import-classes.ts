'use server';
import { createServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export type CsvRow = {
  name: string;       // 中文姓名
  campus: string;     // 耶加校區
  teacher: string;    // 總導師
  englishClass: string; // 英語班級
};

export type ImportResult = {
  inserted: number;
  skipped: number;
  errors: { name: string; reason: string }[];
  insertedPairs: { class_id: string; student_id: string }[];
};

function normalizeTeacherName(raw: string): string {
  return raw.replace(/^(Mr\.|Ms\.|Mrs\.|Dr\.)\s*/i, '').trim().toLowerCase();
}

export async function batchImportClassStudents(rows: CsvRow[], categories: string[]): Promise<ImportResult> {
  const supabase = createServerClient();

  const [
    { data: allStudents },
    { data: allTeachers },
    { data: allClasses },
  ] = await Promise.all([
    supabase.from('students').select('id, name, campus'),
    supabase.from('teachers').select('id, name, english_name'),
    supabase
      .from('classes')
      .select('id, name, category, teacher_id, program_track, status')
      .eq('status', 'active'),
  ]);

  const students = allStudents ?? [];
  const teachers = allTeachers ?? [];
  const classes = allClasses ?? [];

  const errors: { name: string; reason: string }[] = [];
  const toInsert: { class_id: string; student_id: string }[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const studentName = row.name.trim();
    const campus = row.campus.trim();

    // 1. 配對學生
    const student = students.find(
      (s) => s.name === studentName && s.campus === campus
    );
    if (!student) {
      errors.push({ name: studentName, reason: `找不到學生（${campus}）` });
      continue;
    }

    // 2. 配對英語程度班（english_core）
    if (categories.includes('english_core') && row.teacher.trim() && row.teacher.trim() !== '單上英語') {
      const normalized = normalizeTeacherName(row.teacher);
      const teacher = teachers.find((t) => {
        const nameNorm = (t.name ?? '').toLowerCase();
        const engNorm = normalizeTeacherName(t.english_name ?? '');
        return engNorm === normalized || nameNorm.includes(normalized) || normalized.includes(engNorm) || engNorm.includes(normalized);
      });

      if (!teacher) {
        errors.push({ name: studentName, reason: `找不到老師「${row.teacher}」` });
      } else {
        const englishClass = classes.find(
          (c) => c.category === 'english_core' && c.teacher_id === teacher.id
        );
        if (!englishClass) {
          errors.push({ name: studentName, reason: `找不到 ${row.teacher} 的英語程度班` });
        } else {
          const key = `${englishClass.id}:${student.id}`;
          if (!seen.has(key)) {
            seen.add(key);
            toInsert.push({ class_id: englishClass.id, student_id: student.id });
          }
        }
      }
    }

    // 3. 配對英語核心班（english_core）
    if (categories.includes('english_core') && row.englishClass.trim()) {
      const code = row.englishClass.trim().toUpperCase();
      const codeBase = code.replace(/\d+$/, '');  // "JE62" → "JE6"；無尾數字時不變
      const englishClass = classes.find(
        (c) =>
          c.category === 'english_core' &&
          (c.program_track?.toUpperCase() === code ||
            c.program_track?.toUpperCase() === codeBase ||
            c.name.toUpperCase().includes(code) ||
            (codeBase !== code && c.name.toUpperCase().includes(codeBase)))
      );
      if (!englishClass) {
        errors.push({ name: studentName, reason: `找不到英語班「${code}」` });
      } else {
        const key = `${englishClass.id}:${student.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          toInsert.push({ class_id: englishClass.id, student_id: student.id });
        }
      }
    }
  }

  let inserted = 0;
  let skipped = 0;
  let insertedPairs: { class_id: string; student_id: string }[] = [];

  if (toInsert.length > 0) {
    const { data, error } = await supabase
      .from('class_students')
      .upsert(toInsert, { onConflict: 'class_id,student_id', ignoreDuplicates: true })
      .select();

    if (error) throw new Error(error.message);
    insertedPairs = (data ?? []).map((r) => ({ class_id: r.class_id, student_id: r.student_id }));
    inserted = insertedPairs.length;
    skipped = toInsert.length - inserted;
  }

  revalidatePath('/admin/classes');
  return { inserted, skipped, errors, insertedPairs };
}
