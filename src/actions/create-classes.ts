'use server';
import { createServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export type ClassDraft = {
  name: string;
  campus: string;
  category: 'homeroom' | 'english_core';
  teacherRaw: string;
  teacherId: string | null;  // pre-resolved in modal; takes priority over teacherRaw
  programTrack: string | null;
};

export type CreateResult = {
  created: number;
  errors: { name: string; reason: string }[];
  createdIds: string[];
};

function normalizeTeacherName(raw: string): string {
  return raw.replace(/^(Mr\.|Ms\.|Mrs\.|Dr\.)\s*/i, '').trim().toLowerCase();
}

export async function batchCreateClasses(
  drafts: ClassDraft[],
  academicYear: string,
  term: string
): Promise<CreateResult> {
  const supabase = createServerClient();

  // Only fetch teachers if any draft needs server-side name resolution
  const needsResolution = drafts.some((d) => d.category === 'homeroom' && !d.teacherId && d.teacherRaw);
  const allTeachers = needsResolution
    ? (await supabase.from('teachers').select('id, name, english_name')).data ?? []
    : [];

  const toInsert: object[] = [];
  const errors: { name: string; reason: string }[] = [];

  for (const draft of drafts) {
    let teacherId = draft.teacherId || null;

    if (!teacherId && draft.category === 'homeroom' && draft.teacherRaw) {
      const normalized = normalizeTeacherName(draft.teacherRaw);
      const match = allTeachers.find((t) => {
        const nameNorm = (t.name ?? '').toLowerCase();
        const engNorm = normalizeTeacherName(t.english_name ?? '');
        return (
          engNorm === normalized ||
          nameNorm.includes(normalized) ||
          normalized.includes(engNorm) ||
          engNorm.includes(normalized)
        );
      });
      if (!match) {
        errors.push({ name: draft.name, reason: `找不到老師「${draft.teacherRaw}」` });
        continue;
      }
      teacherId = match.id;
    }

    toInsert.push({
      name: draft.name,
      campus: draft.campus,
      category: draft.category,
      teacher_id: teacherId,
      program_track: draft.category === 'english_core' ? draft.programTrack : null,
      academic_year: academicYear || null,
      term: term || null,
      status: 'active',
    });
  }

  if (toInsert.length === 0) return { created: 0, errors, createdIds: [] };

  const { data, error } = await supabase.from('classes').insert(toInsert).select('id');
  if (error) return { created: 0, errors: [...errors, { name: '批次建立', reason: error.message }], createdIds: [] };

  const createdIds = (data ?? []).map((r) => r.id as string);
  revalidatePath('/admin/classes');
  return { created: createdIds.length, errors, createdIds };
}
