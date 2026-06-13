'use client';
import { useState, useTransition, useRef } from 'react';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { batchImportClassStudents, type CsvRow, type ImportResult } from '@/actions/import-classes';
import { UNDO_KEY, type UndoSession } from '@/components/classes/UndoBanner';

function normalizeCampus(raw: string): string {
  const prefix = raw.trim().replace(/\d+$/, '');
  if (prefix === '龍') return '龍華校';
  if (prefix === '文府' || prefix === '文') return '文府總校';
  if (prefix === '左新' || prefix === '左') return '左新校';
  return raw.trim();
}

const CATEGORIES = [
  { value: 'homeroom', label: '教學班' },
  { value: 'english_core', label: '英語核心' },
  { value: 'elective', label: '選修' },
  { value: 'camp', label: '冬夏令營課程' },
];

export default function BatchImportModal({ onClose }: { onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [categories, setCategories] = useState<Set<string>>(new Set(['homeroom', 'english_core', 'elective', 'camp']));
  const [parseError, setParseError] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  function toggleCategory(value: string) {
    setCategories((prev) => {
      const next = new Set(prev);
      next.has(value) ? next.delete(value) : next.add(value);
      return next;
    });
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError('');
    setResult(null);

    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete(results) {
        const raw = results.data as string[][];
        const headers = raw[0] ?? [];
        const dataRows = raw.slice(1);

        const isAplusFormat = (headers[1] ?? '').trim() === 'Ch.';

        if (isAplusFormat) {
          const parsed: CsvRow[] = dataRows
            .map((r) => ({
              name: (r[1] ?? '').trim(),
              campus: normalizeCampus(r[10] ?? ''),
              teacher: (r[2] ?? '').trim(),
              englishClass: (r[8] ?? '').trim() === 'X' ? '' : (r[8] ?? '').trim(),
            }))
            .filter((r) => r.name);
          setRows(parsed);
        } else {
          const idx = {
            name: headers.indexOf('中文姓名'),
            campus: headers.indexOf('耶加校區'),
            teacher: headers.indexOf('總導師'),
            englishClass: headers.indexOf('英語班級'),
          };
          if (idx.name === -1) {
            setParseError('CSV 格式不符，請確認欄位標題包含「中文姓名」、「耶加校區」、「總導師」、「英語班級」，或使用英語分班表格式（含 Ch. 欄位）。');
            return;
          }
          const parsed: CsvRow[] = dataRows
            .map((r) => ({
              name: (r[idx.name] ?? '').trim(),
              campus: (r[idx.campus] ?? '').trim(),
              teacher: (r[idx.teacher] ?? '').trim(),
              englishClass: (r[idx.englishClass] ?? '').trim(),
            }))
            .filter((r) => r.name);
          setRows(parsed);
        }
      },
      error() {
        setParseError('CSV 解析失敗，請確認檔案編碼為 UTF-8。');
      },
    });
  }

  function handleImport() {
    startTransition(async () => {
      const res = await batchImportClassStudents(rows, [...categories]);
      setResult(res);
      if (res.inserted > 0) {
        const session: UndoSession = {
          type: 'student_assignment',
          pairs: res.insertedPairs,
          count: res.inserted,
          ts: Date.now(),
        };
        localStorage.setItem(UNDO_KEY, JSON.stringify(session));
      }
    });
  }

  const preview = rows.slice(0, 5);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-lg shadow-lg w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">批次匯入分班</h2>
        <p className="text-sm text-muted-foreground">
          上傳 CSV 檔案，系統將依「中文姓名 + 耶加校區」配對學生，並分別寫入教學班（總導師）與英語核心班（英語班級）。支援英語分班表格式（含 Ch. 欄位）。
        </p>

        {!result && (
          <div className="space-y-3">
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleFile}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-input file:text-sm file:bg-muted file:cursor-pointer"
            />
            {parseError && <p className="text-sm text-destructive">{parseError}</p>}

            {rows.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  共 {rows.length} 筆資料，預覽前 5 筆：
                </p>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-2">中文姓名</th>
                        <th className="text-left px-3 py-2">耶加校區</th>
                        <th className="text-left px-3 py-2">總導師</th>
                        <th className="text-left px-3 py-2">英語班級</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((r, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-1.5">{r.name}</td>
                          <td className="px-3 py-1.5">{r.campus}</td>
                          <td className="px-3 py-1.5">{r.teacher}</td>
                          <td className="px-3 py-1.5">{r.englishClass || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">匯入班別</p>
              <div className="flex gap-4">
                {CATEGORIES.map((cat) => (
                  <label key={cat.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={categories.has(cat.value)}
                      onChange={() => toggleCategory(cat.value)}
                      className="cursor-pointer"
                    />
                    {cat.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={onClose}>取消</Button>
              <Button onClick={handleImport} disabled={pending || rows.length === 0 || categories.size === 0}>
                {pending ? '匯入中...' : `確認匯入（${rows.length} 筆）`}
              </Button>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-4 text-sm space-y-1">
              <p>✅ 成功寫入：<span className="font-semibold">{result.inserted}</span> 筆</p>
              {result.skipped > 0 && (
                <p className="text-muted-foreground">略過重複：{result.skipped} 筆</p>
              )}
            </div>

            {result.errors.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-destructive">
                  ⚠️ 以下 {result.errors.length} 筆無法配對，請手動補齊：
                </p>
                <div className="rounded-lg border border-destructive/30 overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-destructive/5">
                      <tr>
                        <th className="text-left px-3 py-2">學生姓名</th>
                        <th className="text-left px-3 py-2">失敗原因</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.errors.map((e, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-1.5">{e.name}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{e.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={onClose}>關閉</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
