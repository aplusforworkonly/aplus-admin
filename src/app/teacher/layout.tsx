import TeacherTopBar from '@/components/teacher/TeacherTopBar';
import TeacherBottomNav from '@/components/teacher/TeacherBottomNav';
import { Suspense } from 'react';
import { createSessionClient, createServerClient } from '@/lib/supabase/server';

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let rosteringTabs: string[] = [];

  try {
    const session = await createSessionClient();
    const { data: { user } } = await session.auth.getUser();
    if (user) {
      const supabase = createServerClient();
      const { data: teacher } = await supabase
        .from('teachers')
        .select('id')
        .eq('user_id', user.id)
        .single();
      if (teacher) {
        const { data: perms } = await supabase
          .from('rostering_permissions')
          .select('tab_key')
          .eq('teacher_id', (teacher as any).id);
        rosteringTabs = (perms ?? []).map((p: any) => p.tab_key as string);
      }
    }
  } catch {
    // 無法取得 session 時不中斷頁面渲染
  }

  return (
    <div className="min-h-screen bg-slate-50 relative pb-20 pt-16 w-full">
      <TeacherTopBar />
      {children}
      <Suspense fallback={null}>
        <TeacherBottomNav rosteringTabs={rosteringTabs} />
      </Suspense>
    </div>
  );
}
