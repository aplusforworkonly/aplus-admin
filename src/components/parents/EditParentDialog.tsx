'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateParent } from '@/actions/parents';

type Props = {
  parent: { id: string; name: string; phone: string };
  onClose: () => void;
};

export default function EditParentDialog({ parent, onClose }: Props) {
  const [name, setName] = useState(parent.name ?? '');
  const [phone, setPhone] = useState(parent.phone ?? '');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    startTransition(async () => {
      try {
        await updateParent(parent.id, { name: name.trim(), phone: phone.trim() });
        onClose();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : '儲存失敗，請再試。');
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-lg shadow-lg w-full max-w-sm p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold">編輯家長資料</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">家長姓名</p>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">手機號碼</p>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>取消</Button>
            <Button type="submit" disabled={pending || !name.trim() || !phone.trim()}>
              {pending ? '儲存中...' : '儲存'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
