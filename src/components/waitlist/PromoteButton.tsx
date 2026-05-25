'use client';
import { useFormStatus } from 'react-dom';
import { promoteFromWaitlist } from '@/actions/enrollments';
import { Button } from '@/components/ui/button';

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="sm"
      variant="outline"
      disabled={pending}
      className="text-green-700 border-green-300 hover:bg-green-50 text-xs h-7"
    >
      {pending ? '處理中...' : '轉生效'}
    </Button>
  );
}

export function PromoteButton({ id }: { id: string }) {
  return (
    <form action={promoteFromWaitlist.bind(null, id)}>
      <SubmitBtn />
    </form>
  );
}
