import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RoutineListClient } from '@/components/tasks/RoutineListClient';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default async function RoutinesPage() {
  const supabase = createServerClient();

  const [{ data: defs }, { data: teachers }] = await Promise.all([
    supabase
      .from('routine_definitions')
      .select('*, assigned_teacher:teachers!assigned_to(id, name)')
      .order('created_at', { ascending: false }),
    supabase.from('teachers').select('id, name').eq('status', 'active').order('name'),
  ]);

  const activeCount = (defs ?? []).filter((d) => d.is_active).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/tasks">
          <Button variant="ghost" size="sm">← 返回任務清單</Button>
        </Link>
        <h1 className="text-2xl font-bold">例行任務範本</h1>
      </div>

      <div className="flex gap-3">
        <Card className="flex-1">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-normal">啟用中範本</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{activeCount}</p>
          </CardContent>
        </Card>
        <Card className="flex-1">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-normal">全部範本</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{(defs ?? []).length}</p>
          </CardContent>
        </Card>
      </div>

      <RoutineListClient defs={(defs ?? []) as any} teachers={teachers ?? []} />
    </div>
  );
}
