import { notFound } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import CourseForm from '@/components/courses/CourseForm';
import Link from 'next/link';

export default async function EditCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServerClient();
  const { data: course, error } = await supabase
    .from('courses')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !course) notFound();

  return (
    <div className="p-6 max-w-xl space-y-4">
      <Link href="/courses" className="text-sm text-muted-foreground hover:text-foreground">
        ← 課程管理
      </Link>
      <h1 className="text-2xl font-bold">編輯課程</h1>
      <CourseForm course={course} />
    </div>
  );
}
