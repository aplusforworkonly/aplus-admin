'use client';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { cancelLeaveRequest } from '@/actions/leave-requests';

export default function CancelButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!confirm('確定要取消此請假申請？若已核准，相關請假紀錄將一併刪除。')) return;
        start(() => cancelLeaveRequest(id));
      }}
      className="text-xs h-7 px-2 text-muted-foreground hover:text-destructive"
    >
      {pending ? '取消中…' : '取消申請'}
    </Button>
  );
}
