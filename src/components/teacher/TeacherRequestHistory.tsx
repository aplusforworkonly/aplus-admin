import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import CancellationRequestButton from '@/components/teacher/CancellationRequestButton';

type RequestEntry = {
  id: string;
  rawLeaveId?: string;
  type: '取消課程' | '加報課程' | '請假' | '取消請假';
  status: string;
  studentName: string;
  studentEnglishName?: string | null;
  detail: string | null;
  reason: string;
  created_at: string;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'pending') {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full border bg-orange-50 text-orange-700 border-orange-200">
        待審核
      </span>
    );
  }
  if (status === 'approved') {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full border bg-green-50 text-green-700 border-green-200">
        已核准
      </span>
    );
  }
  if (status === 'cancelled') {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
        已取消
      </span>
    );
  }
  return (
    <span className="text-xs px-2 py-0.5 rounded-full border bg-gray-100 text-gray-500 border-gray-200">
      已退回
    </span>
  );
}

const TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  取消課程: { label: '取消', cls: 'bg-red-50 text-red-700 border-red-200' },
  加報課程: { label: '加報', cls: 'bg-green-50 text-green-700 border-green-200' },
  請假:     { label: '請假', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  取消請假: { label: '取消請假', cls: 'bg-slate-100 text-slate-600 border-slate-300' },
};

function CancelAction({
  row,
  teacherId,
  cancellingIds,
  canCancel,
}: {
  row: RequestEntry;
  teacherId: string;
  cancellingIds: Set<string>;
  canCancel: boolean;
}) {
  if (!canCancel || !row.rawLeaveId || row.type !== '請假') return null;
  if (row.status !== 'pending' && row.status !== 'approved') return null;

  if (cancellingIds.has(row.rawLeaveId)) {
    return <span className="text-xs text-muted-foreground">取消審核中</span>;
  }

  return <CancellationRequestButton refRequestId={row.rawLeaveId} teacherId={teacherId} />;
}

function RequestTable({
  rows,
  teacherId,
  cancellingIds,
  canCancel,
}: {
  rows: RequestEntry[];
  teacherId: string;
  cancellingIds: Set<string>;
  canCancel: boolean;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-3">尚無紀錄。</p>;
  }
  return (
    <>
      {/* 手機：卡片堆疊 */}
      <div className="sm:hidden space-y-3">
        {rows.map((r) => {
          const tb = TYPE_BADGE[r.type];
          return (
            <div key={r.id} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="bg-slate-50/80 px-4 py-3 border-b border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`text-xs px-2.5 py-1 rounded-md font-medium border ${tb?.cls ?? ''}`}>
                    {tb?.label ?? r.type}
                  </span>
                  <StatusBadge status={r.status} />
                </div>
                <p className="font-semibold text-sm text-slate-800">
                  {r.studentName}
                  {r.studentEnglishName && <span className="text-xs text-slate-500 ml-1 font-normal">({r.studentEnglishName})</span>}
                </p>
              </div>
              <div className="p-4 space-y-3">
                {r.detail && <p className="text-xs text-muted-foreground">{r.detail}</p>}
                {r.reason && <p className="text-sm text-slate-700 bg-slate-50/50 p-2.5 rounded-md border border-slate-100">{r.reason}</p>}
                <p className="text-xs text-slate-400 font-mono mt-1">{formatDate(r.created_at)}</p>
                <CancelAction row={r} teacherId={teacherId} cancellingIds={cancellingIds} canCancel={canCancel} />
              </div>
            </div>
          );
        })}
      </div>

      {/* 桌機：Table */}
      <div className="hidden sm:block rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-36">申請日期</TableHead>
              <TableHead className="w-20">類型</TableHead>
              <TableHead>學生 / 詳情</TableHead>
              <TableHead>原因</TableHead>
              <TableHead className="w-20 text-right">狀態</TableHead>
              <TableHead className="w-28"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const tb = TYPE_BADGE[r.type];
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {formatDate(r.created_at)}
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${tb?.cls ?? ''}`}>
                      {tb?.label ?? r.type}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    <span className="font-medium">{r.studentName}</span>
                    {r.studentEnglishName && (
                      <span className="text-xs text-muted-foreground ml-1">({r.studentEnglishName})</span>
                    )}
                    {r.detail && (
                      <p className="text-xs text-muted-foreground mt-0.5">{r.detail}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-48 truncate">
                    {r.reason || '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell>
                    <CancelAction row={r} teacherId={teacherId} cancellingIds={cancellingIds} canCancel={canCancel} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

export default function TeacherRequestHistory({
  requests,
  teacherId,
  cancellingIds,
  canCancel,
}: {
  requests: RequestEntry[];
  teacherId: string;
  cancellingIds: Set<string>;
  canCancel: boolean;
}) {
  const leaveRequests = requests.filter((r) => r.type === '請假' || r.type === '取消請假');
  const courseRequests = requests.filter((r) => r.type === '取消課程' || r.type === '加報課程');

  if (requests.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        尚無任何申請紀錄。
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-medium">請假通報</p>
        <RequestTable rows={leaveRequests} teacherId={teacherId} cancellingIds={cancellingIds} canCancel={canCancel} />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">課程異動申請</p>
        <RequestTable rows={courseRequests} teacherId={teacherId} cancellingIds={cancellingIds} canCancel={canCancel} />
      </div>
    </div>
  );
}
