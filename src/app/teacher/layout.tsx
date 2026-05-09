import TeacherTopBar from '@/components/teacher/TeacherTopBar';
import TeacherBottomNav from '@/components/teacher/TeacherBottomNav';
import { Suspense } from 'react';

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 relative pb-20 pt-16 w-full">
      <TeacherTopBar />
      {children}
      <Suspense fallback={null}>
        <TeacherBottomNav />
      </Suspense>
    </div>
  );
}
