'use server';
import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';

const normalizePhone = (p: string) => p.replace(/\D/g, '');

export async function findParentByPhone(phone: string): Promise<{ id: string; name: string } | null> {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  const supabase = createServerClient();
  const { data } = await supabase.from('parents').select('id, name, phone');
  const match = (data ?? []).find((p) => normalizePhone(p.phone ?? '') === normalized);
  return match ? { id: match.id, name: match.name } : null;
}

export async function updateParent(id: string, data: { name: string; phone: string }) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from('parents')
    .update({ name: data.name, phone: normalizePhone(data.phone) })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/parents');
}

export async function linkParentToStudent(
  studentId: string,
  phone: string,
  name: string,
  relationship: '父' | '母' | '其他'
) {
  const supabase = createServerClient();
  const normalized = normalizePhone(phone);

  // Find existing parent by normalized phone
  const { data: allParents } = await supabase.from('parents').select('id, phone');
  const existing = (allParents ?? []).find(
    (p) => normalizePhone(p.phone ?? '') === normalized
  );

  let parentId: string;
  if (existing) {
    parentId = existing.id;
  } else {
    const { data: newParent, error } = await supabase
      .from('parents')
      .insert({ name, phone: normalized })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    parentId = newParent.id;
  }

  const { error: mapErr } = await supabase
    .from('parent_student_mapping')
    .insert({ student_id: studentId, parent_id: parentId, relationship });
  if (mapErr) throw new Error(mapErr.message);

  revalidatePath(`/students/${studentId}`);
}

export async function unlinkParentFromStudent(mappingId: string, studentId: string) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from('parent_student_mapping')
    .delete()
    .eq('id', mappingId);
  if (error) throw new Error(error.message);
  revalidatePath(`/students/${studentId}`);
}
