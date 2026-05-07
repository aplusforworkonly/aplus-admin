import { createServerClient } from '@/lib/supabase/server';
import CourseTable from '@/components/courses/CourseTable';

export default async function CoursesPage() {
  const supabase = createServerClient();
  const { data: courses, error } = await supabase
    .from('courses')
    .select('*')
    .order('course_type')
    .order('name');
  if (error) throw new Error(error.message);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">課程管理</h1>
      <CourseTable courses={courses ?? []} />
    </div>
  );
}
