'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { linkParentToStudent, findParentByPhone } from '@/actions/parents';

const RELATIONSHIP_OPTIONS = ['父', '母', '其他'] as const;

type Props = {
  studentId: string;
  onClose: () => void;
  onDone: () => void;
};

export default function LinkParentDialog({ studentId, onClose, onDone }: Props) {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState<'父' | '母' | '其他'>('其他');
  const [autoFilled, setAutoFilled] = useState(false);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  const selectCls = 'h-9 rounded-md border border-input bg-background px-3 text-sm w-full';

  async function handlePhoneBlur() {
    const trimmed = phone.trim();
    if (!trimmed) return;
    const found = await findParentByPhone(trimmed);
    if (found) {
      setName(found.name || '');
      setAutoFilled(true);
    } else {
      setAutoFilled(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    startTransition(async () => {
      try {
        await linkParentToStudent(studentId, phone.trim(), name.trim(), relationship);
        onDone();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : '綁定失敗，請再試。');
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
        <h2 className="text-base font-semibold">新增 / 綁定家長</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">家長手機 <span className="text-destructive">*</span></p>
            <Input
              type="tel"
              placeholder="09XX-XXX-XXX"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setAutoFilled(false); }}
              onBlur={handlePhoneBlur}
              required
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              家長姓名 <span className="text-destructive">*</span>
              {autoFilled && (
                <span className="ml-2 text-green-600 font-normal">已找到既有家長，自動帶入</span>
              )}
            </p>
            <Input
              placeholder="輸入家長姓名"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">與學生關係</p>
            <select
              className={selectCls}
              value={relationship}
              onChange={(e) => setRelationship(e.target.value as '父' | '母' | '其他')}
            >
              {RELATIONSHIP_OPTIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>取消</Button>
            <Button type="submit" disabled={pending || !phone.trim() || !name.trim()}>
              {pending ? '綁定中...' : '確認綁定'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
