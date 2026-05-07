'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { importTeachersFromSheet } from '@/actions/import';

export default function ImportTeachersButton() {
  const [result, setResult] = useState<{ imported: number; skipped: number; error?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function handleImport() {
    setResult(null);
    startTransition(async () => {
      const res = await importTeachersFromSheet();
      setResult(res);
    });
  }

  return (
    <div className="flex items-center gap-3">
      <Button variant="outline" onClick={handleImport} disabled={pending}>
        {pending ? '同步中...' : '從 Google Sheet 同步'}
      </Button>
      {result && !result.error && (
        <span className="text-sm text-green-700">
          已匯入／更新 {result.imported} 位在職老師（略過 {result.skipped} 筆）
        </span>
      )}
      {result?.error && (
        <span className="text-sm text-destructive">{result.error}</span>
      )}
    </div>
  );
}
