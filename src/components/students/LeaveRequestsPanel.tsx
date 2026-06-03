import CancelButton from '@/components/leaves/CancelButton';

type LeaveRequest = {
  id: string;
  status: string;
  leave_date: string | null;
  leave_date_end: string | null;
  leave_type: string | null;
  reason: string | null;
  note: string | null;
  teacher_id: string | null;
  parent_id: string | null;
  teachers: { name: string; english_name: string | null } | null;
  parents: { name: string } | null;
};

function statusLabel(s: string) {
  if (s === 'pending') return { text: '待審', cls: 'bg-orange-50 text-orange-700 border-orange-200' };
  if (s === 'approved') return { text: '已核准', cls: 'bg-green-50 text-green-700 border-green-200' };
  if (s === 'cancelled') return { text: '已取消', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
  return { text: '已退回', cls: 'bg-gray-100 text-gray-500 border-gray-200' };
}

function submitterName(req: LeaveRequest): string {
  if (req.teacher_id && req.teachers) {
    const t = req.teachers;
    return `老師：${t.english_name ? `${t.english_name}（${t.name}）` : t.name}`;
  }
  if (req.parent_id && req.parents) return `家長：${req.parents.name}`;
  return '—';
}

function RequestRow({ req, showCancel }: { req: LeaveRequest; showCancel: boolean }) {
  const { text, cls } = statusLabel(req.status);
  const dateStr = req.leave_date
    ? req.leave_date_end
      ? `${req.leave_date} ～ ${req.leave_date_end}`
      : req.leave_date
    : '—';

  return (
    <div className="flex items-start justify-between py-2.5 border-b last:border-0 gap-3">
      <div className="space-y-0.5 min-w-0">
        <p className="text-sm font-mono">{dateStr}
          {req.leave_type && <span className="ml-2 font-sans font-normal text-muted-foreground">{req.leave_type}</span>}
        </p>
        <p className="text-xs text-muted-foreground">{submitterName(req)}</p>
        {(req.reason || req.note) && (
          <p className="text-xs text-muted-foreground truncate max-w-xs">{req.reason ?? req.note}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-xs px-2 py-0.5 rounded-full border ${cls}`}>{text}</span>
        {showCancel && <CancelButton id={req.id} />}
      </div>
    </div>
  );
}

export default function LeaveRequestsPanel({ requests }: { requests: LeaveRequest[] }) {
  if (requests.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">此學生目前無請假申請</p>
    );
  }

  const active = requests.filter((r) => r.status === 'pending' || r.status === 'approved');
  const history = requests.filter((r) => r.status === 'cancelled' || r.status === 'rejected');

  return (
    <div className="space-y-1">
      {active.length === 0 && (
        <p className="text-sm text-muted-foreground py-2">目前無待審或已核准的請假申請</p>
      )}
      {active.map((req) => (
        <RequestRow key={req.id} req={req} showCancel />
      ))}

      {history.length > 0 && (
        <details className="pt-2">
          <summary className="text-sm text-muted-foreground cursor-pointer select-none">
            歷史紀錄（{history.length} 筆）
          </summary>
          <div className="mt-1 pl-1">
            {history.map((req) => (
              <div key={req.id} className="flex items-start justify-between py-1.5 border-b last:border-0 gap-3 text-xs text-muted-foreground">
                <div className="space-y-0.5">
                  <p className="font-mono">
                    {req.leave_date ?? '—'}
                    {req.leave_date_end ? ` ～ ${req.leave_date_end}` : ''}
                    {req.leave_type && <span className="ml-2 font-sans">{req.leave_type}</span>}
                  </p>
                  <p>{submitterName(req)}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${statusLabel(req.status).cls}`}>
                  {statusLabel(req.status).text}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
