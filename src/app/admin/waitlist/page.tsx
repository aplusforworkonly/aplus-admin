import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PromoteButton } from '@/components/waitlist/PromoteButton';

export default async function WaitlistPage() {
  const supabase = createServerClient();

  const { data: waitlist } = await supabase
    .from('enrollments')
    .select('id, student_id, contract_no, campus, start_date, created_at, course_id, students(name, english_name), courses(name, max_capacity, course_type)')
    .eq('status', '候補')
    .order('created_at');

  const courseIds = [...new Set((waitlist ?? []).map((e: any) => e.course_id).filter(Boolean))];
  const enrollCountMap: Record<string, number> = {};
  if (courseIds.length > 0) {
    const { data: counts } = await supabase
      .from('enrollments')
      .select('course_id')
      .in('course_id', courseIds)
      .eq('status', '生效');
    for (const e of counts ?? []) {
      enrollCountMap[(e as any).course_id] = (enrollCountMap[(e as any).course_id] ?? 0) + 1;
    }
  }

  const byCourse = (waitlist ?? []).reduce((acc: Record<string, any[]>, e: any) => {
    if (!acc[e.course_id]) acc[e.course_id] = [];
    acc[e.course_id].push(e);
    return acc;
  }, {});

  const courseEntries = Object.entries(byCourse);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">候補管理</h1>
        {waitlist && waitlist.length > 0 && (
          <Badge variant="secondary">{waitlist.length} 人候補中</Badge>
        )}
      </div>

      {courseEntries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            目前沒有候補名單
          </CardContent>
        </Card>
      ) : (
        courseEntries.map(([courseId, entries]) => {
          const firstEntry = entries[0];
          const courseName = firstEntry.courses?.name ?? '未知課程';
          const maxCap: number | null = firstEntry.courses?.max_capacity ?? null;
          const enrolled = enrollCountMap[courseId] ?? 0;
          const waitCount = entries.length;

          return (
            <Card key={courseId}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-3">
                  {courseName}
                  <span className="text-sm font-normal text-muted-foreground">
                    {maxCap != null
                      ? `已報名 ${enrolled} / ${maxCap} 人`
                      : `已報名 ${enrolled} 人`}
                  </span>
                  <Badge variant="outline" className="ml-auto text-amber-700 border-amber-300 bg-amber-50">
                    候補 {waitCount} 人
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10 pl-6">#</TableHead>
                      <TableHead>學生</TableHead>
                      <TableHead>校區</TableHead>
                      <TableHead>報名月份</TableHead>
                      <TableHead>候補日期</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((e: any, idx: number) => (
                      <TableRow key={e.id}>
                        <TableCell className="pl-6 text-muted-foreground text-sm">{idx + 1}</TableCell>
                        <TableCell className="font-medium">
                          <p>{e.students?.name ?? '—'}</p>
                          {e.students?.english_name && (
                            <p className="text-xs text-muted-foreground">{e.students.english_name}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{e.campus ?? '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {e.start_date
                            ? new Date(e.start_date).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long' })
                            : '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(e.created_at).toLocaleDateString('zh-TW')}
                        </TableCell>
                        <TableCell>
                          <PromoteButton id={e.id} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
