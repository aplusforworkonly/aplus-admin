import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get('studentId');
  if (!studentId) return NextResponse.json([]);

  const supabase = createServerClient();
  const { data } = await supabase
    .from('enrollments')
    .select('course_id, courses(id, name)')
    .eq('student_id', studentId)
    .eq('status', '生效');

  const courses = (data ?? []).map((e: any) => ({
    id: e.courses?.id,
    name: e.courses?.name,
  })).filter((c: any) => c.id);

  return NextResponse.json(courses);
}
