'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { deleteClass } from '@/actions/classes';

export default function DeleteClassButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    if (!confirm('確定要刪除這個班級嗎？刪除後分班名單也會一併移除。')) return;
    startTransition(async () => {
      await deleteClass(id);
      router.push('/admin/classes');
    });
  }

  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={handleDelete}
      className="text-destructive hover:text-destructive">
      刪除班級
    </Button>
  );
}
