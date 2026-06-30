import { createServerClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import CancelRequestButtons from '@/components/requests/CancelRequestButtons';
import Link from 'next/link';
import { CAMPUSES } from '@/lib/constants';

const REQUEST_TYPES: { value: string; label: string }[] = [
  { value: 'add', label: '加報課程' },
  { value: 'cancel', label: '取消課程' },
  { value: 'departure', label: '離校通知' },
  { value: 'purchase', label: '物品購買' },
  { value: 'half_day', label: '半日異動' },
  { value: 'meal', label: '新增餐點' },
];

function statusLabel(s: string) {
  if (s === 'pending') return '待審';
  if (s === 'approved') return '核准';
  if (s === 'rejected') return '退回';
  return s;
}

function AuditLogEntries({ logs }: { logs: any[] }) {
  if (logs.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="space-y-1">
      {logs.map((log: any, i: number) => (
        <div key={i} className="text-xs flex items-center gap-1">
          <span className="text-muted-foreground">{statusLabel(log.from_status)}</span>
          <span className="text-muted-foreground">→</span>
          <span className={log.to_status === 'approved' ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
            {statusLabel(log.to_status)}
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-muted-foreground">{log.teachers?.name ?? '—'}</span>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-muted-foreground">{new Date(log.created_at).toLocaleDateString('zh-TW')}</span>
        </div>
      ))}
    </div>
  );
}

function RequestTypeBadge({ requestType }: { requestType: string }) {
  if (requestType === 'add') {
    return <Badge variant="secondary">加報課程</Badge>;
  }
  if (requestType === 'purchase') {
    return <Badge className="bg-teal-600 hover:bg-teal-700">物品購買</Badge>;
  }
  if (requestType === 'departure') {
    return <Badge variant="destructive">離校通知</Badge>;
  }
  if (requestType === 'half_day') {
    return <Badge className="bg-purple-600 hover:bg-purple-700">半日異動</Badge>;
  }
  if (requestType === 'meal') {
    return <Badge className="bg-amber-500 hover:bg-amber-600">新增餐點</Badge>;
  }
  return <Badge variant="outline">取消課程</Badge>;
}

function formatReason(r: any) {
  if (r.request_type === 'purchase' || r.request_type === 'departure') {
    try {
      const parsed = JSON.parse(r.reason || '{}');
      if (r.request_type === 'purchase') return `品項：${parsed.item}，數量：${parsed.qty}`;
      if (r.request_type === 'departure') return `[離校日期: ${parsed.date}] ${parsed.reason}`;
    } catch (e) {}
  }
  if (r.request_type === 'half_day') {
    try {
      const parsed = JSON.parse(r.reason || '{}');
      const dates = (parsed.dates ?? []).join('、');
      const typeLabel = parsed.halfDayType === 'PM' ? '下半日' : '上半日';
      return `日期：${dates || '—'}　${typeLabel}　${parsed.includeMeal ? '含餐' : '不含餐'}`;
    } catch (e) {}
  }
  if (r.request_type === 'meal') {
    try {
      const parsed = JSON.parse(r.reason || '{}');
      const dates = (parsed.dates ?? []).join('、');
      return `用餐日期：${dates || '—'}`;
    } catch (e) {}
  }
  return r.reason ?? '—';
}

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ campus?: string; type?: string }>;
}) {
  const { campus, type } = await searchParams;
  const supabase = createServerClient();

  let pendingQuery = supabase
    .from('student_requests')
    .select('id, request_type, reason, created_at, start_date, course_id, students(name, english_name, campus), courses(name, max_capacity), teachers!teacher_id(name, english_name)')
    .eq('status', 'pending')
    .order('created_at');
  if (type) pendingQuery = pendingQuery.eq('request_type', type);

  let historyQuery = supabase
    .from('student_requests')
    .select('id, status, request_type, reason, created_at, handled_at, handled_by, start_date, students(name, english_name, campus), courses(name), teachers!teacher_id(name, english_name)')
    .in('status', ['approved', 'rejected'])
    .order('handled_at', { ascending: false });
  if (type) historyQuery = historyQuery.eq('request_type', type);

  const [{ data: pending }, { data: history }] = await Promise.all([pendingQuery, historyQuery]);

  const historyIds = (history ?? []).map((r: any) => r.id);
  let auditByRequestId: Record<string, any[]> = {};
  if (historyIds.length > 0) {
    const { data: auditLogs } = await supabase
      .from('request_audit_log')
      .select('request_id, from_status, to_status, created_at, teachers(name)')
      .in('request_id', historyIds)
      .order('created_at');
    for (const log of auditLogs ?? []) {
      if (!auditByRequestId[log.request_id]) auditByRequestId[log.request_id] = [];
      auditByRequestId[log.request_id].push(log);
    }
  }

  const handledByIds = [...new Set((history ?? []).map((r: any) => r.handled_by).filter(Boolean))];
  let handledByNames: Record<string, string> = {};
  if (handledByIds.length > 0) {
    const { data: teacherRows } = await supabase.from('teachers').select('id, name').in('id', handledByIds);
    for (const t of teacherRows ?? []) handledByNames[t.id] = t.name;
  }

  const addCourseIds = [...new Set(
    (pending ?? [])
      .filter((r: any) => r.request_type === 'add' && r.courses?.max_capacity != null)
      .map((r: any) => r.course_id)
      .filter(Boolean)
  )];
  const pendingEnrollCountMap: Record<string, number> = {};
  if (addCourseIds.length > 0) {
    const { data: ec } = await supabase
      .from('enrollments')
      .select('course_id')
      .in('course_id', addCourseIds)
      .eq('status', '生效');
    for (const e of ec ?? []) {
      pendingEnrollCountMap[(e as any).course_id] = (pendingEnrollCountMap[(e as any).course_id] ?? 0) + 1;
    }
  }

  const filteredPending = (pending ?? []).filter((r: any) =>
    !campus || (r.students as any)?.campus === campus
  );
  const filteredHistory = (history ?? []).filter((r: any) =>
    !campus || (r.students as any)?.campus === campus
  );

  function buildLink(overrides: { campus?: string; type?: string }) {
    const p = new URLSearchParams();
    const c = 'campus' in overrides ? overrides.campus : campus;
    const t = 'type' in overrides ? overrides.type : type;
    if (c) p.set('campus', c);
    if (t) p.set('type', t);
    const qs = p.toString();
    return `/admin/requests${qs ? `?${qs}` : ''}`;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">異動審核</h1>
        {filteredPending.length > 0 && (
          <Badge variant="destructive">{filteredPending.length}</Badge>
        )}
        {/* 校區篩選 */}
        <div className="flex gap-1.5 ml-auto flex-wrap">
          <Link href={buildLink({ campus: '' })}
            className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${!campus ? 'bg-primary text-primary-foreground border-primary' : 'border-input hover:bg-muted'}`}>
            全部校區
          </Link>
          {CAMPUSES.map((c) => (
            <Link key={c} href={buildLink({ campus: c })}
              className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${campus === c ? 'bg-primary text-primary-foreground border-primary' : 'border-input hover:bg-muted'}`}>
              {c}
            </Link>
          ))}
        </div>
      </div>

      {/* 異動類型篩選 */}
      <div className="flex gap-1.5 flex-wrap">
        <Link href={buildLink({ type: '' })}
          className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${!type ? 'bg-primary text-primary-foreground border-primary' : 'border-input hover:bg-muted'}`}>
          全部類型
        </Link>
        {REQUEST_TYPES.map((rt) => (
          <Link key={rt.value} href={buildLink({ type: rt.value })}
            className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${type === rt.value ? 'bg-primary text-primary-foreground border-primary' : 'border-input hover:bg-muted'}`}>
            {rt.label}
          </Link>
        ))}
      </div>

      {/* 待審核 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            待審核的課程異動申請
            {filteredPending.length > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">（{filteredPending.length} 筆）</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">類型</TableHead>
                <TableHead>學生</TableHead>
                <TableHead>課程</TableHead>
                <TableHead>申請老師</TableHead>
                <TableHead>原因</TableHead>
                <TableHead>申請時間</TableHead>
                <TableHead className="w-36"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPending.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    目前無待審核申請
                  </TableCell>
                </TableRow>
              )}
              {filteredPending.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell><RequestTypeBadge requestType={r.request_type} /></TableCell>
                  <TableCell className="font-medium">
                    <p>{r.students?.name ?? '—'}</p>
                    {(r.students as any)?.english_name && (
                      <p className="text-xs text-muted-foreground">{(r.students as any).english_name}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    <p>{r.courses?.name ?? '—'}</p>
                    {r.start_date && (
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.start_date).toLocaleDateString('zh-TW', { month: 'long' })}
                      </p>
                    )}
                    {r.request_type === 'add' && r.courses?.max_capacity != null && (() => {
                      const enrolled = pendingEnrollCountMap[r.course_id] ?? 0;
                      const max = r.courses.max_capacity;
                      const isFull = enrolled >= max;
                      return (
                        <p className={`text-xs mt-0.5 ${isFull ? 'text-rose-600 font-medium' : 'text-muted-foreground'}`}>
                          {enrolled}/{max} 人{isFull ? '（核准後將列候補）' : ''}
                        </p>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.teachers
                      ? ((r.teachers as any).english_name
                          ? `${(r.teachers as any).english_name}（${r.teachers.name}）`
                          : r.teachers.name)
                      : '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs whitespace-pre-wrap break-words">
                    {formatReason(r)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString('zh-TW')}
                  </TableCell>
                  <TableCell>
                    <CancelRequestButtons id={r.id} requestType={r.request_type} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 已處理歷史紀錄 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-muted-foreground">
            已處理紀錄
            <span className="ml-2 text-sm font-normal">（{filteredHistory.length} 筆）</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">類型</TableHead>
                <TableHead>學生</TableHead>
                <TableHead>課程</TableHead>
                <TableHead>申請老師</TableHead>
                <TableHead>原因</TableHead>
                <TableHead>處理人員</TableHead>
                <TableHead>處理時間</TableHead>
                <TableHead className="w-20">結果</TableHead>
                <TableHead>審核歷程</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredHistory.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    無已處理紀錄
                  </TableCell>
                </TableRow>
              )}
              {filteredHistory.map((r: any) => (
                <TableRow key={r.id} className="text-muted-foreground">
                  <TableCell><RequestTypeBadge requestType={r.request_type} /></TableCell>
                  <TableCell className="font-medium text-foreground">
                    <p>{r.students?.name ?? '—'}</p>
                    {(r.students as any)?.english_name && (
                      <p className="text-xs text-muted-foreground">{(r.students as any).english_name}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    <p>{r.courses?.name ?? '—'}</p>
                    {r.start_date && (
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.start_date).toLocaleDateString('zh-TW', { month: 'long' })}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {(r as any).teachers
                      ? ((r as any).teachers.english_name
                          ? `${(r as any).teachers.english_name}（${(r as any).teachers.name}）`
                          : (r as any).teachers.name)
                      : '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs whitespace-pre-wrap break-words">
                    {formatReason(r)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {(auditByRequestId[r.id] ?? []).at(-1)?.teachers?.name ?? handledByNames[r.handled_by] ?? '—'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.handled_at ? new Date(r.handled_at).toLocaleDateString('zh-TW') : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.status === 'approved' ? 'default' : 'outline'}>
                      {r.status === 'approved' ? '已核准' : '已退回'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <AuditLogEntries logs={auditByRequestId[r.id] ?? []} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
