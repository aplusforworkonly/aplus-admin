import CourseForm from '@/components/courses/CourseForm';
import Link from 'next/link';

export default function NewCoursePage() {
  return (
    <div className="p-6 max-w-xl space-y-4">
      <Link href="/courses" className="text-sm text-muted-foreground hover:text-foreground">
        ← 課程管理
      </Link>
      <h1 className="text-2xl font-bold">新增課程</h1>
      <CourseForm />
    </div>
  );
}
