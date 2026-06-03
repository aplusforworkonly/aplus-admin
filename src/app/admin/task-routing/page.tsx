import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RoutingRuleListClient } from '@/components/tasks/RoutingRuleListClient';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default async function TaskRoutingPage() {
  const supabase = createServerClient();

  const [{ data: rules }, { data: teachers }] = await Promise.all([
    supabase
      .from('task_routing_rules')
      .select('*, assigned_teacher:teachers!assigned_to(id, name, campus)')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true }),
    supabase
      .from('teachers')
      .select('id, name, campus')
      .eq('department', '學務部')
      .eq('status', '在職')
      .order('campus')
      .order('name'),
  ]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/tasks">
          <Button variant="ghost" size="sm">← 返回任務管理</Button>
        </Link>
        <h1 className="text-2xl font-bold">自動指派規則</h1>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-normal text-muted-foreground">
            規則比對邏輯：校區 + 任務類型 + 年級範圍皆符合時自動指派給負責人。
            空白欄位 = 萬用（任意值皆命中）。多條規則同時命中時，優先級數字較大的優先。
            若無規則命中，系統自動兜底指派給該校區的學務主管。
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RoutingRuleListClient
            rules={(rules ?? []) as any}
            teachers={teachers ?? []}
          />
        </CardContent>
      </Card>
    </div>
  );
}
