export const dynamic = 'force-dynamic';

import { createServerClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

const TYPE_LABEL: Record<string, string> = {
  main_course: '基本課程',
  camp: '營隊',
  trip: '校外活動',
  material: '教材',
};

const TYPE_ORDER: Record<string, number> = {
  camp: 0,
  main_course: 1,
  trip: 2,
  material: 3,
};

const TYPE_BADGE: Record<string, string> = {
  main_course: 'bg-primary text-primary-foreground',
  camp: 'bg-secondary text-secondary-foreground',
  trip: 'border border-input text-foreground',
  material: 'border border-input text-foreground',
};

export default async function CourseStatsPage() {
  const supabase = createServerClient();

  const [{ data: courses }, { data: enrollments }] = await Promise.all([
    supabase.from('courses').select('id, name, course_type, max_capacity'),
    supabase
      .from('enrollments')
      .select('course_id, status')
      .in('status', ['生效', '候補']),
  ]);

  // Count per course per status
  const countMap: Record<string, { active: number; waitlist: number }> = {};
  for (const e of enrollments ?? []) {
    if (!countMap[e.course_id]) countMap[e.course_id] = { active: 0, waitlist: 0 };
    if (e.status === '生效') countMap[e.course_id].active++;
    if (e.status === '候補') countMap[e.course_id].waitlist++;
  }

  const rows = (courses ?? [])
    .map((c: any) => ({
      ...c,
      active: countMap[c.id]?.active ?? 0,
      waitlist: countMap[c.id]?.waitlist ?? 0,
    }))
    .filter((c: any) => c.active > 0 || c.waitlist > 0)
    .sort((a: any, b: any) => {
      const typeDiff = (TYPE_ORDER[a.course_type] ?? 9) - (TYPE_ORDER[b.course_type] ?? 9);
      if (typeDiff !== 0) return typeDiff;
      return a.name.localeCompare(b.name, 'zh-TW');
    });

  const totalActive = rows.reduce((s: number, r: any) => s + r.active, 0);
  const totalWaitlist = rows.reduce((s: number, r: any) => s + r.waitlist, 0);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-baseline gap-4">
        <h1 className="text-2xl font-bold">課程報名統計</h1>
        <span className="text-sm text-muted-foreground">
          共 {rows.length} 門課程・生效 {totalActive} 人次・候補 {totalWaitlist} 人次
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>課程名稱</TableHead>
            <TableHead className="w-24">類型</TableHead>
            <TableHead className="w-20 text-right">生效</TableHead>
            <TableHead className="w-20 text-right">候補</TableHead>
            <TableHead className="w-20 text-right">上限</TableHead>
            <TableHead className="w-28 text-right">使用率</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                目前無報名資料
              </TableCell>
            </TableRow>
          )}
          {rows.map((r: any) => {
            const pct = r.max_capacity
              ? Math.round((r.active / r.max_capacity) * 100)
              : null;
            const full = pct !== null && pct >= 100;
            return (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGE[r.course_type] ?? 'border border-input'}`}>
                    {TYPE_LABEL[r.course_type] ?? r.course_type}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.active}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {r.waitlist > 0 ? r.waitlist : '—'}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {r.max_capacity ?? '不限'}
                </TableCell>
                <TableCell className="text-right">
                  {pct !== null ? (
                    <span className={full ? 'text-red-600 font-semibold' : ''}>
                      {pct}%{full && ' 額滿'}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
