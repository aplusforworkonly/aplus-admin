'use server';
import { createServerClient } from '@/lib/supabase/server';

export async function uploadMedicalProof(formData: FormData): Promise<string> {
  const file = formData.get('file') as File;
  const studentId = formData.get('studentId') as string;
  if (!file || !studentId) throw new Error('缺少檔案或學生 ID');

  const supabase = createServerClient();
  const path = `${studentId}/${Date.now()}-${file.name}`;
  const bytes = await file.arrayBuffer();
  const { data, error } = await supabase.storage
    .from('medical-proof')
    .upload(path, Buffer.from(bytes), { contentType: file.type });
  if (error) throw new Error(error.message);

  return supabase.storage.from('medical-proof').getPublicUrl(data.path).data.publicUrl;
}
