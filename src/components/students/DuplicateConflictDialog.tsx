'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { renameStudent, createStudentWithSiblingLink, type StudentPayload } from '@/actions/students';

type Props = {
  newStudentName: string;
  parentPhone: string;
  parentId: string;
  existingStudents: { id: string; name: string; english_name: string | null }[];
  studentPayload: StudentPayload;
  onClose: () => void;
  onDone: (studentId: string) => void;
};

const RELATIONSHIP_OPTIONS = ['父', '母', '其他'] as const;

export default function DuplicateConflictDialog({
  newStudentName,
  parentPhone,
  parentId,
  existingStudents,
  studentPayload,
  onClose,
  onDone,
}: Props) {
  const [mode, setMode] = useState<'choose' | 'typo' | 'sibling'>('choose');
  const [selectedStudentId, setSelectedStudentId] = useState(
    existingStudents.length === 1 ? existingStudents[0].id : ''
  );
  const [relationship, setRelationship] = useState<'父' | '母' | '其他'>('其他');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function handleTypoConfirm() {
    if (!selectedStudentId) return;
    setError('');
    startTransition(async () => {
      try {
        await renameStudent(selectedStudentId, newStudentName);
        onDone(selectedStudentId);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : '更正失敗，請再試。');
      }
    });
  }

  function handleSiblingConfirm() {
    setError('');
    startTransition(async () => {
      try {
        const id = await createStudentWithSiblingLink(studentPayload, parentId, relationship);
        onDone(id);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : '建立失敗，請再試。');
      }
    });
  }

  const selectCls = 'h-9 rounded-md border border-input bg-background px-3 text-sm w-full';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-lg shadow-lg w-full max-w-md p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="space-y-1">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <span className="text-yellow-500">⚠</span> 發現疑似重複建檔
          </h2>
          <p className="text-sm text-muted-foreground">
            電話 <span className="font-mono font-medium text-foreground">{parentPhone}</span> 已綁定以下學生：
          </p>
        </div>

        {/* 已存在學生清單 */}
        <div className="rounded-md border bg-muted/40 px-4 py-3 space-y-1">
          {existingStudents.map((s) => (
            <p key={s.id} className="text-sm font-medium">
              · {s.name}
              {s.english_name && <span className="text-xs text-muted-foreground ml-1">({s.english_name})</span>}
            </p>
          ))}
        </div>

        <p className="text-sm">
          您正在新增的學生姓名為：
          <span className="font-semibold text-foreground ml-1">「{newStudentName}」</span>
        </p>

        {/* 初始選擇畫面 */}
        {mode === 'choose' && (
          <div className="flex gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1 text-sm"
              onClick={() => setMode('typo')}
            >
              這是打錯字，更正原檔案
            </Button>
            <Button
              type="button"
              className="flex-1 text-sm"
              onClick={() => setMode('sibling')}
            >
              這是親手足，建立新檔案
            </Button>
          </div>
        )}

        {/* Option A：打錯字 */}
        {mode === 'typo' && (
          <div className="space-y-4">
            {existingStudents.length > 1 && (
              <div className="space-y-1">
                <p className="text-sm font-medium">選擇要更正哪筆舊檔案</p>
                <div className="space-y-2">
                  {existingStudents.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="radio"
                        name="selectedStudent"
                        value={s.id}
                        checked={selectedStudentId === s.id}
                        onChange={() => setSelectedStudentId(s.id)}
                        className="accent-primary"
                      />
                      {s.name}
                      {s.english_name && <span className="text-xs text-muted-foreground">({s.english_name})</span>}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
              將把
              {existingStudents.find((s) => s.id === selectedStudentId)
                ? <span className="font-semibold mx-1">「{existingStudents.find((s) => s.id === selectedStudentId)!.name}」</span>
                : '選取的學生'}
              的姓名更正為
              <span className="font-semibold mx-1">「{newStudentName}」</span>，
              其他資料不變。
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setMode('choose')}>← 返回</Button>
              <Button
                type="button"
                disabled={!selectedStudentId || pending}
                onClick={handleTypoConfirm}
              >
                {pending ? '更正中...' : '確認更正'}
              </Button>
            </div>
          </div>
        )}

        {/* Option B：手足 */}
        {mode === 'sibling' && (
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">此家長與新學生的關係</p>
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
            <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-800">
              將建立新學生
              <span className="font-semibold mx-1">「{newStudentName}」</span>
              並綁定至同一家長。
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setMode('choose')}>← 返回</Button>
              <Button type="button" disabled={pending} onClick={handleSiblingConfirm}>
                {pending ? '建立中...' : '確認建立新檔'}
              </Button>
            </div>
          </div>
        )}

        {/* 取消按鈕（初始選擇時） */}
        {mode === 'choose' && (
          <div className="flex justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              取消
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
