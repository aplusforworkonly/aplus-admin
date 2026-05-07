'use client';
import { useState, useTransition, useRef } from 'react';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { batchCreateClasses, type ClassDraft, type CreateResult } from '@/actions/create-classes';
import { UNDO_KEY, type UndoSession } from '@/components/classes/UndoBanner';

const TERMS = ['上學期', '下學期', '夏令營', '冬令營'];

type Teacher = { id: string; name: string; english_name: string | null; department: string | null };

function normalizeCampus(raw: string): string {
  const prefix = raw.trim().replace(/\d+$/, '');
  if (prefix === '龍') return '龍華校';
  if (prefix === '文府' || prefix === '文') return '文府總校';
  if (prefix === '左新' || prefix === '左') return '左新校';
  return raw.trim();
}

function normalizeTeacherName(raw: string): string {
  return raw.replace(/^(Mr\.|Ms\.|Mrs\.|Dr\.)\s*/i, '').trim().toLowerCase();
}

function matchTeacherId(raw: string, teachers: Teacher[]): string | null {
  if (!raw) return null;
  const normalized = normalizeTeacherName(raw);
  const match = teachers.find((t) => {
    const nameNorm = (t.name ?? '').toLowerCase();
    const engNorm = normalizeTeacherName(t.english_name ?? '');
    return (
      engNorm === normalized ||
      nameNorm.includes(normalized) ||
      normalized.includes(engNorm) ||
      engNorm.includes(normalized)
    );
  });
  return match?.id ?? null;
}

function filterTeachers(teachers: Teacher[], category: string): Teacher[] {
  if (category === 'homeroom') return teachers.filter((t) => t.department === '教學部');
  if (category === 'english_core') return teachers.filter((t) => t.department === '英語部');
  if (category === 'elective') return teachers.filter((t) => t.department === '教學部' || t.department === '英語部');
  return [];
}

function teacherLabel(t: Teacher): string {
  return t.english_name ? `${t.name} / ${t.english_name}` : t.name;
}

function parseCsvToDrafts(raw: string[][], teachers: Teacher[]): ClassDraft[] {
  const headers = raw[0]?.map((h) => h.replace(/^﻿/, '').trim()) ?? [];
  const dataRows = raw.slice(1);
  const isAplusFormat = (headers[1] ?? '') === 'Ch.';

  const homeroomMap = new Map<string, ClassDraft>();
  const englishMap = new Map<string, ClassDraft>();

  for (const r of dataRows) {
    let teacherRaw: string;
    let campus: string;
    let classCode: string;

    if (isAplusFormat) {
      teacherRaw = (r[2] ?? '').trim();
      campus = normalizeCampus(r[10] ?? '');
      classCode = (r[8] ?? '').trim();
      const englishTeacherRaw = (r[9] ?? '').trim();

      if (classCode && classCode !== 'X' && campus) {
        const key = `${classCode}|${campus}`;
        if (!englishMap.has(key)) {
          englishMap.set(key, {
            name: classCode,
            campus,
            category: 'english_core',
            teacherRaw: englishTeacherRaw,
            teacherId: matchTeacherId(englishTeacherRaw, teachers),
            programTrack: classCode,
          });
        }
      }
    } else {
      const idxTeacher = headers.indexOf('總導師');
      const idxCampus = headers.indexOf('耶加校區');
      const idxClass = headers.indexOf('英語班級');
      teacherRaw = (r[idxTeacher] ?? '').trim();
      campus = (r[idxCampus] ?? '').trim();
      classCode = (r[idxClass] ?? '').trim();
    }

    if (teacherRaw && teacherRaw !== '單上英語' && campus) {
      const key = `${teacherRaw}|${campus}`;
      if (!homeroomMap.has(key)) {
        homeroomMap.set(key, {
          name: teacherRaw,
          campus,
          category: 'homeroom',
          teacherRaw,
          teacherId: matchTeacherId(teacherRaw, teachers),
          programTrack: null,
        });
      }
    }

    if (classCode && classCode !== 'X' && campus) {
      const key = `${classCode}|${campus}`;
      if (!englishMap.has(key)) {
        englishMap.set(key, {
          name: classCode,
          campus,
          category: 'english_core',
          teacherRaw: '',
          teacherId: null,
          programTrack: classCode,
        });
      }
    }
  }

  return [...homeroomMap.values(), ...englishMap.values()];
}

export default function BatchCreateClassesModal({
  teachers,
  onClose,
}: {
  teachers: Teacher[];
  onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [academicYear, setAcademicYear] = useState('');
  const [term, setTerm] = useState('');
  const [drafts, setDrafts] = useState<ClassDraft[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [parseError, setParseError] = useState('');
  const [result, setResult] = useState<CreateResult | null>(null);
  const [pending, startTransition] = useTransition();

  const selectCls = 'h-9 rounded-md border border-input bg-background px-3 text-sm';

  function toggleOne(idx: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }

  function toggleSection(indices: number[], allChecked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      indices.forEach((i) => (allChecked ? next.delete(i) : next.add(i)));
      return next;
    });
  }

  function setDraftTeacher(idx: number, teacherId: string) {
    setDrafts((prev) => prev.map((d, i) => i === idx ? { ...d, teacherId: teacherId || null } : d));
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError('');
    setDrafts([]);
    setSelected(new Set());

    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete(results) {
        const raw = results.data as string[][];
        const headers = raw[0]?.map((h) => h.replace(/^﻿/, '').trim()) ?? [];
        const isAplusFormat = (headers[1] ?? '') === 'Ch.';

        if (!isAplusFormat && headers.indexOf('中文姓名') === -1) {
          setParseError('CSV 格式不符，請上傳英語分班表或包含「中文姓名」欄位的分班檔案。');
          return;
        }

        const parsed = parseCsvToDrafts(raw, teachers);
        if (parsed.length === 0) {
          setParseError('未偵測到任何班級資料，請確認檔案內容。');
          return;
        }
        setDrafts(parsed);
        setSelected(new Set(parsed.map((_, i) => i)));
      },
      error() {
        setParseError('CSV 解析失敗，請確認檔案編碼為 UTF-8。');
      },
    });
  }

  function handleCreate() {
    const toDo = drafts.filter((_, i) => selected.has(i));
    startTransition(async () => {
      const res = await batchCreateClasses(toDo, academicYear, term);
      setResult(res);
      if (res.createdIds.length > 0) {
        const session: UndoSession = {
          type: 'class_creation',
          classIds: res.createdIds,
          count: res.created,
          ts: Date.now(),
        };
        localStorage.setItem(UNDO_KEY, JSON.stringify(session));
      }
    });
  }

  const homeroomIndices = drafts.map((_, i) => i).filter((i) => drafts[i].category === 'homeroom');
  const englishIndices = drafts.map((_, i) => i).filter((i) => drafts[i].category === 'english_core');
  const allHomeroomsChecked = homeroomIndices.length > 0 && homeroomIndices.every((i) => selected.has(i));
  const allEnglishChecked = englishIndices.length > 0 && englishIndices.every((i) => selected.has(i));

  function SectionTable({
    indices,
    label,
    allChecked,
    teacherColLabel,
  }: {
    indices: number[];
    label: string;
    allChecked: boolean;
    teacherColLabel: string;
  }) {
    if (indices.length === 0) return null;
    const category = drafts[indices[0]]?.category ?? 'homeroom';
    const availableTeachers = filterTeachers(teachers, category);

    return (
      <div className="space-y-1.5">
        <p className="text-sm font-medium">
          {label}（已選 {indices.filter((i) => selected.has(i)).length} / {indices.length} 個）
        </p>
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 w-8">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={() => toggleSection(indices, allChecked)}
                    className="cursor-pointer"
                  />
                </th>
                <th className="text-left px-3 py-2">班級名稱</th>
                <th className="text-left px-3 py-2">校區</th>
                <th className="text-left px-3 py-2">{teacherColLabel}</th>
              </tr>
            </thead>
            <tbody>
              {indices.map((idx) => (
                <tr
                  key={idx}
                  className={`border-t cursor-pointer hover:bg-muted/30 transition-opacity ${!selected.has(idx) ? 'opacity-40' : ''}`}
                  onClick={() => toggleOne(idx)}
                >
                  <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(idx)}
                      onChange={() => toggleOne(idx)}
                      className="cursor-pointer"
                    />
                  </td>
                  <td className="px-3 py-1.5">{drafts[idx].name}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{drafts[idx].campus}</td>
                  <td className="px-3 py-1" onClick={(e) => e.stopPropagation()}>
                    <select
                      className="h-7 rounded border border-input bg-background px-2 text-xs w-full"
                      value={drafts[idx].teacherId ?? ''}
                      onChange={(e) => setDraftTeacher(idx, e.target.value)}
                    >
                      <option value="">— 未指定 —</option>
                      {availableTeachers.map((t) => (
                        <option key={t.id} value={t.id}>{teacherLabel(t)}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-lg shadow-lg w-full max-w-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">批次建立班級</h2>

        {!result && (
          <>
            <div className="flex gap-3">
              <div className="space-y-1 flex-1">
                <p className="text-xs text-muted-foreground">學年度 <span className="text-destructive">*</span></p>
                <Input
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  placeholder="如 114"
                />
              </div>
              <div className="space-y-1 flex-1">
                <p className="text-xs text-muted-foreground">學期 <span className="text-destructive">*</span></p>
                <select className={`${selectCls} w-full`} value={term} onChange={(e) => setTerm(e.target.value)}>
                  <option value="">— 請選擇 —</option>
                  {TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">上傳分班 CSV 檔案</p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                onChange={handleFile}
                className="block w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-input file:text-sm file:bg-muted file:cursor-pointer"
              />
              {parseError && <p className="text-sm text-destructive">{parseError}</p>}
            </div>

            {drafts.length > 0 && (
              <div className="space-y-4">
                <SectionTable
                  indices={homeroomIndices}
                  label="教學班"
                  allChecked={allHomeroomsChecked}
                  teacherColLabel="負責老師（教學部）"
                />
                <SectionTable
                  indices={englishIndices}
                  label="英語核心班"
                  allChecked={allEnglishChecked}
                  teacherColLabel="負責老師（英語部）"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={onClose}>取消</Button>
              <Button
                onClick={handleCreate}
                disabled={pending || selected.size === 0 || !academicYear || !term}
              >
                {pending ? '建立中...' : `確認建立（${selected.size} 個班級）`}
              </Button>
            </div>
          </>
        )}

        {result && (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-4 text-sm">
              <p>✅ 成功建立：<span className="font-semibold">{result.created}</span> 個班級</p>
            </div>

            {result.errors.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-destructive">
                  ⚠️ 以下 {result.errors.length} 個班級建立失敗：
                </p>
                <div className="rounded-lg border border-destructive/30 overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-destructive/5">
                      <tr>
                        <th className="text-left px-3 py-2">班級</th>
                        <th className="text-left px-3 py-2">原因</th>
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
