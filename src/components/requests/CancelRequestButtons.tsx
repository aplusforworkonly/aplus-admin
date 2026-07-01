'use client';
import { useTransition, useState } from 'react';
import { Button } from '@/components/ui/button';
import { approveCancelRequest, rejectCancelRequest } from '@/actions/cancel-requests';

export default function CancelRequestButtons({ id, requestType }: { id: string; requestType: string }) {
  const [pending, startTransition] = useTransition();
  const [isCashPaid, setIsCashPaid] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState('');

  return (
    <div className="flex flex-col gap-2 items-end">
      {!rejectOpen ? (
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={pending}
            onClick={() => startTransition(() => approveCancelRequest(id, isCashPaid))}
          >
            核准
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => setRejectOpen(true)}
          >
            拒絕
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 w-48">
          <textarea
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="退回原因（選填）"
            rows={2}
            className="text-xs border rounded px-2 py-1 bg-background resize-none w-full focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="destructive"
              className="text-xs h-7 flex-1"
              disabled={pending}
              onClick={() => startTransition(() => rejectCancelRequest(id, rejectNote || undefined))}
            >
              {pending ? '退回中…' : '確認退回'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-xs h-7"
              disabled={pending}
              onClick={() => { setRejectOpen(false); setRejectNote(''); }}
            >
              取消
            </Button>
          </div>
        </div>
      )}
      {requestType === 'purchase' && !rejectOpen && (
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={isCashPaid}
            onChange={(e) => setIsCashPaid(e.target.checked)}
            className="rounded border-slate-300"
          />
          現場已收現
        </label>
      )}
    </div>
  );
}
