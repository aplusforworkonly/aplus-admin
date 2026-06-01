import { createServerClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ApproveButtons from '@/components/leaves/ApproveButtons';
import Link from 'next/link';

const CAMPUSES = ['文府總校', '龍華校', '左新校'];

export default async function LeavesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; campus?: string }>;
}) {
  const { month, campus } = await searchParams;
  const supabase = createServerClient();

  const now = new Date();
  const currentMonth = month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const startDate = `${currentMonth}-01`;
  const [y, m] = currentMonth.split('-').map(Number);
  const endDate = new Date(y, m, 1).toISOString().split('T')[0];

  const [{ data: leaves }, { data: pending }, { data: history }] = await Promise.all([

    supabase
      .from('student_leaves')
      .select('id, leave_date, leave_type, note, students(name, english_name, campus)')
      .gte('leave_date', startDate)
      .lt('leave_date', endDate)
      .order('leave_date'),
    supabase
      .from('leave_requests')
      .select('id, request_type, leave_date, leave_date_end, leave_type, reason, note, status, created_at, disease_type, proof_file_url, teacher_id, parent_id, students(name, english_name, campus), teachers!teacher_id(name, english_name), parents(name), courses(name)')
      .eq('status', 'pending')
      .order('created_at'),
    supabase
      .from('leave_requests')
      .select('id, status, request_type, leave_date, leave_date_end, leave_type, reason, handled_at, disease_type, proof_file_url, students(name, english_name), teachers!handled_by(name, english_name)')
      .in('status', ['approved', 'rejected'])
      .order('handled_at', { ascending: false })
      .limit(50),
  ]);

  const leaveHistoryIds = (history ?? []).map((r: any) => r.id);
  let leaveAuditByRequestId: Record<string, any[]> = {};
  if (leaveHistoryIds.length > 0) {
    const { data: auditLogs } = await supabase
      .from('request_audit_log')
      .select('request_id, from_status, to_status, created_at, teachers(name)')
      .in('request_id', leaveHistoryIds)
      .order('created_at');
    for (const log of auditLogs ?? []) {
      if (!leaveAuditByRequestId[log.request_id]) leaveAuditByRequestId[log.request_id] = [];
      leaveAuditByRequestId[log.request_id].push(log);
    }
  }

  const filteredPending = (pending ?? []).filter((r: any) =>
    !campus || (r.students as any)?.campus === campus
  );
  const filteredLeaves = (leaves ?? []).filter((l: any) =>
    !campus || (l.students as any)?.campus === campus
  );

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

  const LEAVE_TYPE_COLOR: Record<string, string> = {
    '病假': 'bg-red-50 text-red-700 border-red-200',
    '事假': 'bg-blue-50 text-blue-700 border-blue-200',
    '喪假': 'bg-gray-100 text-gray-700 border-gray-300',
    '活動日': 'bg-purple-50 text-purple-700 border-purple-200',
    '其他': 'bg-muted text-muted-foreground',
  };

  const months = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 2 + i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }).reverse();

  function monthLink(mo: string) {
    const p = new URLSearchParams();
    p.set('month', mo);
    if (campus) p.set('campus', campus);
    return `/leaves?${p}`;
  }

  function campusLink(c: string) {
    const p = new URLSearchParams();
    p.set('month', currentMonth);
    if (c) p.set('campus', c);
    return `/leaves?${p}`;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold">請假管理</h1>
        {/* 校區過濾 */}
        <div className="flex gap-1.5 ml-auto">
          <Link
            href={campusLink('')}
            className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${!campus ? 'bg-primary text-primary-foreground border-primary' : 'border-input hover:bg-muted'}`}
          >
            全部
          </Link>
          {CAMPUSES.map((c) => (
            <Link
              key={c}
              href={campusLink(c)}
              className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${campus === c ? 'bg-primary text-primary-foreground border-primary' : 'border-input hover:bg-muted'}`}
            >
              {c}
            </Link>
          ))}
        </div>
      </div>

      {/* 待審核 */}
      {filteredPending.length > 0 && (
        <Card className="border-yellow-300">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              待確認申請
              <Badge variant="destructive">{filteredPending.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>學生</TableHead>
                  <TableHead>類型</TableHead>
                  <TableHead>內容</TableHead>
                  <TableHead>送出者</TableHead>
                  <TableHead>備註</TableHead>
                  <TableHead className="w-32"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPending.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      <p>{r.students?.name}</p>
                      {(r.students as any)?.english_name && (
                        <p className="text-xs text-muted-foreground">{(r.students as any).english_name}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant={r.request_type === '退班' ? 'destructive' : 'outline'}>
                          {r.request_type}
                        </Badge>
                        {r.disease_type && (
                          <span className="text-xs px-1.5 py-0.5 rounded border bg-red-50 text-red-700 border-red-200">
                            {r.disease_type}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.request_type === '請假'
                        ? `${r.leave_date}${r.leave_date_end ? ` ～ ${r.leave_date_end}` : ''}　${r.leave_type ?? ''}`
                        : r.courses?.name ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.teacher_id
                        ? `老師：${(r.teachers as any)?.english_name ? `${(r.teachers as any).english_name}（${r.teachers?.name}）` : (r.teachers?.name ?? '')}`
                        : `家長：${r.parents?.name ?? ''}`}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div className="space-y-1">
                        <span>{r.reason ?? r.note ?? '—'}</span>
                        {r.proof_file_url && (
                          <a href={r.proof_file_url} target="_blank" rel="noopener noreferrer"
                            className="block text-xs text-blue-600 hover:underline">
                            查看醫療證明
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <ApproveButtons id={r.id} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* 月份切換 */}
      <div className="flex gap-2 items-center">
        {months.map((mo) => (
          <Link
            key={mo}
            href={monthLink(mo)}
            className={[
              'inline-flex items-center justify-center h-8 rounded-md border px-3 text-xs font-medium transition-colors',
              currentMonth === mo
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-background hover:bg-accent',
            ].join(' ')}
          >
            {mo}
          </Link>
        ))}
        <span className="text-sm text-muted-foreground ml-auto">共 {filteredLeaves.length} 筆</span>
      </div>

      {/* 本月請假清單 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{currentMonth} 請假紀錄</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">日期</TableHead>
                <TableHead>學生</TableHead>
                <TableHead className="w-24">假別</TableHead>
                <TableHead>備註</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeaves.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    本月無請假紀錄
                  </TableCell>
                </TableRow>
              )}
              {filteredLeaves.map((l: any) => (
                <TableRow key={l.id}>
                  <TableCell className="font-mono text-sm">{l.leave_date}</TableCell>
                  <TableCell className="font-medium">
                    <p>{l.students?.name}</p>
                    {(l.students as any)?.english_name && (
                      <p className="text-xs text-muted-foreground">{(l.students as any).english_name}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    {l.leave_type ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${LEAVE_TYPE_COLOR[l.leave_type] ?? ''}`}>
                        {l.leave_type}
                      </span>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{l.note ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 已處理歷史紀錄 */}
      {(history ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-muted-foreground">已處理紀錄（最近 50 筆）</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>學生</TableHead>
                  <TableHead>假別 / 疾病</TableHead>
                  <TableHead>請假日期</TableHead>
                  <TableHead>處理人員</TableHead>
                  <TableHead>處理時間</TableHead>
                  <TableHead className="w-20">結果</TableHead>
                  <TableHead>原因</TableHead>
                  <TableHead>審核歷程</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(history ?? []).map((r: any) => (
                  <TableRow key={r.id} className="text-muted-foreground">
                    <TableCell className="font-medium text-foreground">
                      <p>{r.students?.name ?? '—'}</p>
                      {(r.students as any)?.english_name && (
                        <p className="text-xs text-muted-foreground">{(r.students as any).english_name}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex flex-col gap-0.5">
                        <span>{r.leave_type ?? '—'}</span>
                        {r.disease_type && (
                          <span className="text-xs text-red-600">{r.disease_type}</span>
                        )}
                        {r.proof_file_url && (
                          <a href={r.proof_file_url} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline">
                            查看醫療證明
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-mono">
                      {r.leave_date
                        ? r.leave_date_end
                          ? `${r.leave_date} ～ ${r.leave_date_end}`
                          : r.leave_date
                        : '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {(r as any).teachers
                        ? ((r as any).teachers.english_name
                            ? `${(r as any).teachers.english_name}（${(r as any).teachers.name}）`
                            : (r as any).teachers.name)
                        : '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.handled_at ? new Date(r.handled_at).toLocaleDateString('zh-TW') : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.status === 'approved' ? 'default' : 'outline'}>
                        {r.status === 'approved' ? '已核准' : '已退回'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.reason ?? '—'}
                    </TableCell>
                    <TableCell>
                      <AuditLogEntries logs={leaveAuditByRequestId[r.id] ?? []} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
