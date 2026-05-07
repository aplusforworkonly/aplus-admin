'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { deleteTeacher } from '@/actions/teachers';

export default function DeleteTeacherButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    if (!confirm('確定要刪除這位老師嗎？')) return;
    startTransition(async () => {
      await deleteTeacher(id);
      router.push('/teachers');
    });
  }

  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={handleDelete}
      className="text-destructive hover:text-destructive">
      刪除
    </Button>
  );
}
