import { createServerClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import DeleteClassButton from '@/components/classes/DeleteClassButton';
import { ClassScheduleManager } from '@/components/classes/ClassScheduleManager';

const CATEGORY_LABELS: Record<string, string> = {
  homeroom: '教學班',
  english_core: '英語核心',
  elective: '選修',
};

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createServerClient();

  const { data: cls } = await supabase
    .from('classes')
    .select('*, teachers(name), courses(course_type)')
    .eq('id', id)
    .single();

  if (!cls) notFound();

  const { data: classSchedules } = await supabase
    .from('class_schedules')
    .select('*')
    .eq('class_id', id)
    .order('day_of_week')
    .order('start_time');

  // 全面防禦：courses 關聯可能不存在（課程已刪除）
  const courseType = (cls.courses as any)?.course_type as string | undefined;
  const matrixTab = courseType === 'main_course' ? 'english' : 'camp';
  const matrixHref = cls.course_id
    ? `/admin/classes/matrix?tab=${matrixTab}&courseIds=${encodeURIComponent(cls.course_id)}`
    : `/admin/classes/matrix`;

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <Link
        href="/admin/classes"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← 分班管理
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline">{CATEGORY_LABELS[cls.category] ?? cls.category}</Badge>
            {cls.program_track && <Badge variant="secondary">{cls.program_track}</Badge>}
          </div>
          <h1 className="text-2xl font-bold">{cls.name}</h1>
          <p className="text-sm text-muted-foreground">
            {cls.campus}
            {(cls.teachers as any)?.name
              ? `　負責老師：${(cls.teachers as any).name}`
              : '　尚未指定老師'}
          </p>
        </div>
        <DeleteClassButton id={id} />
      </div>

      <div className="rounded-xl border bg-blue-50 border-blue-200 px-5 py-4 flex items-start justify-between gap-4">
        <p className="text-sm text-blue-800">
          本頁面已關閉手動調整名單功能。如需分班或調整學生，請前往分班管理矩陣。
        </p>
        <Link
          href={matrixHref}
          className="shrink-0 text-sm font-medium text-blue-700 underline hover:text-blue-900"
        >
          前往分班矩陣 →
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>課程時段</CardTitle>
        </CardHeader>
        <CardContent>
          <ClassScheduleManager classId={id} schedules={classSchedules ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
