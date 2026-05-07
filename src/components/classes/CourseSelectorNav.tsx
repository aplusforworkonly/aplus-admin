'use client';
import { useRouter } from 'next/navigation';

export default function CourseSelectorNav({
  courses,
  currentCourseId,
}: {
  courses: { id: string; name: string }[];
  currentCourseId: string;
}) {
  const router = useRouter();
  return (
    <select
      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
      value={currentCourseId}
      onChange={(e) => router.push(`/admin/classes/matrix?courseId=${e.target.value}`)}
    >
      {courses.map((c) => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
  );
}
