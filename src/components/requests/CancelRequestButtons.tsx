'use client';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { approveCancelRequest, rejectCancelRequest } from '@/actions/cancel-requests';

export default function CancelRequestButtons({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        disabled={pending}
        onClick={() => startTransition(() => approveCancelRequest(id))}
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
  );
}
