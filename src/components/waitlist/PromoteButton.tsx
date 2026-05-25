'use client';
import { useTransition } from 'react';
import { promoteFromWaitlist } from '@/actions/enrollments';
import { Button } from '@/components/ui/button';

export function PromoteButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      className="text-green-700 border-green-300 hover:bg-green-50 text-xs h-7"
      onClick={() => startTransition(() => promoteFromWaitlist(id))}
    >
      {pending ? '處理中...' : '轉生效'}
    </Button>
  );
}
