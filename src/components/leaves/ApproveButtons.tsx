'use client';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { approveLeaveRequest, rejectLeaveRequest } from '@/actions/leave-requests';

export default function ApproveButtons({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex gap-1">
      <Button
        size="sm"
        disabled={pending}
        onClick={() => startTransition(() => approveLeaveRequest(id))}
      >
        核准
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => startTransition(() => rejectLeaveRequest(id))}
        className="text-destructive hover:text-destructive"
      >
        拒絕
      </Button>
    </div>
  );
}
