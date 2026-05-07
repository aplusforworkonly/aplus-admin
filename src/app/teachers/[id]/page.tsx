import { createServerClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import DeleteTeacherButton from '@/components/teachers/DeleteTeacherButton';
import EditTeacherForm from '@/components/teachers/EditTeacherForm';
import Link from 'next/link';

export default async function TeacherDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createServerClient();

  const { data: teacher } = await supabase
    .from('teachers')
    .select('*')
    .eq('id', id)
    .single();

  if (!teacher) notFound();

  return (
    <div className="p-6 max-w-xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/teachers" className="text-sm text-muted-foreground hover:text-foreground">
            ← 老師管理
          </Link>
          <h1 className="text-2xl font-bold mt-1">{teacher.name}</h1>
          <p className="text-sm text-muted-foreground">{teacher.email}　{teacher.campus ?? ''}</p>
        </div>
        <DeleteTeacherButton id={id} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>基本資料</CardTitle>
        </CardHeader>
        <CardContent>
          <EditTeacherForm teacher={teacher} />
        </CardContent>
      </Card>
    </div>
  );
}
