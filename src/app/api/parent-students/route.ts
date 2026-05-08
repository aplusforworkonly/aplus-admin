import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get('phone')?.trim();
  if (!phone) return NextResponse.json([]);

  const supabase = createServerClient();

  const { data: parent } = await supabase
    .from('parents')
    .select('id')
    .eq('phone', phone)
    .single();

  if (!parent) return NextResponse.json([]);

  const { data: mappings } = await supabase
    .from('parent_student_mapping')
    .select('students(id, name, english_name)')
    .eq('parent_id', parent.id);

  const students = (mappings ?? [])
    .map((m: any) => m.students)
    .filter(Boolean)
    .sort((a: any, b: any) => a.name.localeCompare(b.name, 'zh-TW'));

  return NextResponse.json(students);
}
