'use client';
import { useTransition, useState } from 'react';
import { Button } from '@/components/ui/button';
import { approveCancelRequest, rejectCancelRequest } from '@/actions/cancel-requests';

export default function CancelRequestButtons({ id, requestType }: { id: string; requestType: string }) {
  const [pending, startTransition] = useTransition();
  const [isCashPaid, setIsCashPaid] = useState(false);

  return (
    <div className="flex flex-col gap-2 items-end">
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
          onClick={() => startTransition(() => rejectCancelRequest(id))}
        >
          拒絕
        </Button>
      </div>
      {requestType === 'purchase' && (
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
