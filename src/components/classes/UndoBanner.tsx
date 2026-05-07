'use client';
import { useEffect, useState, useTransition } from 'react';
import { undoStudentImport, undoClassCreation } from '@/actions/undo-import';

export const UNDO_KEY = 'aplus_undo_session';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type UndoSession =
  | { type: 'student_assignment'; pairs: { class_id: string; student_id: string }[]; count: number; ts: number }
  | { type: 'class_creation'; classIds: string[]; count: number; ts: number };

export default function UndoBanner() {
  const [session, setSession] = useState<UndoSession | null>(null);
  const [undone, setUndone] = useState(false);
  const [undoError, setUndoError] = useState('');
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(UNDO_KEY);
      if (!raw) return;
      const s: UndoSession = JSON.parse(raw);
      if (Date.now() - s.ts > MAX_AGE_MS) {
        localStorage.removeItem(UNDO_KEY);
        return;
      }
      setSession(s);
    } catch {}
  }, []);

  function dismiss() {
    localStorage.removeItem(UNDO_KEY);
    setSession(null);
    setUndone(false);
    setUndoError('');
  }

  function handleUndo() {
    if (!session) return;
    setUndoError('');
    startTransition(async () => {
      const result =
        session.type === 'student_assignment'
          ? await undoStudentImport(session.pairs)
          : await undoClassCreation(session.classIds);

      if (!result.success) {
        setUndoError(result.error ?? '復原失敗，請稍後再試。');
        return;
      }
      localStorage.removeItem(UNDO_KEY);
      setSession(null);
      setUndone(true);
    });
  }

  if (undone) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm flex items-center justify-between">
        <span className="text-green-700">已成功復原上一次操作。</span>
        <button onClick={() => setUndone(false)} className="text-green-500 hover:text-green-700 ml-4">✕</button>
      </div>
    );
  }

  if (!session) return null;

  const ageMin = Math.round((Date.now() - session.ts) / 60000);
  const ageLabel = ageMin < 1 ? '剛才' : ageMin < 60 ? `${ageMin} 分鐘前` : `${Math.round(ageMin / 60)} 小時前`;

  const label =
    session.type === 'student_assignment'
      ? `${ageLabel}匯入了 ${session.count} 筆學生分班記錄`
      : `${ageLabel}批次建立了 ${session.count} 個班級`;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm flex items-center justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-amber-800">{label}</span>
        {undoError && <span className="text-destructive text-xs">{undoError}</span>}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={handleUndo}
          disabled={pending}
          className="font-medium text-amber-700 hover:text-amber-900 underline underline-offset-2 disabled:opacity-50"
        >
          {pending ? '復原中...' : '復原此次操作'}
        </button>
        <button onClick={dismiss} className="text-amber-400 hover:text-amber-600 text-base leading-none">✕</button>
      </div>
    </div>
  );
}
