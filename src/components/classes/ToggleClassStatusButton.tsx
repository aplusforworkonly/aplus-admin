'use client';
import { useTransition } from 'react';
import { toggleClassStatus } from '@/actions/classes';

export default function ToggleClassStatusButton({
  id,
  status,
}: {
  id: string;
  status: 'active' | 'archived';
}) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await toggleClassStatus(id, status === 'active' ? 'archived' : 'active');
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline disabled:opacity-50"
    >
      {pending ? '...' : status === 'active' ? '封存' : '啟用'}
    </button>
  );
}
