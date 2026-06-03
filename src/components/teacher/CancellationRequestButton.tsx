'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { submitCancellationRequest } from '@/actions/leave-requests';

export default function CancellationRequestButton({
  refRequestId,
  teacherId,
}: {
  refRequestId: string;
  teacherId: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (done) return <span className="text-xs text-muted-foreground">取消申請已送出</span>;

  return (
    <div className="flex flex-col gap-1">
      {!open ? (
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-7"
          onClick={() => setOpen(true)}
        >
          申請取消
        </Button>
      ) : (
        <div className="flex flex-col gap-1.5">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="取消原因（選填）"
            className="text-xs border rounded px-2 py-1 w-48 bg-background"
          />
          {errorMsg && <p className="text-xs text-destructive">{errorMsg}</p>}
          <div className="flex gap-1">
            <Button
              size="sm"
              className="text-xs h-7"
              disabled={pending}
              onClick={() => {
                setErrorMsg('');
                start(async () => {
                  try {
                    await submitCancellationRequest(refRequestId, teacherId, reason);
                    setDone(true);
                    setOpen(false);
                  } catch (e: any) {
                    setErrorMsg(e.message ?? '送出失敗，請稍後再試');
                  }
                });
              }}
            >
              {pending ? '送出中…' : '確認送出'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => { setOpen(false); setErrorMsg(''); }}
            >
              取消
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
