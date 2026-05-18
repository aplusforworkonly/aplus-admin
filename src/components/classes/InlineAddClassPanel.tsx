'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClass, updateClassInfo } from '@/actions/classes';

type Teacher = { id: string; name: string; english_name: string | null };
type ExistingClass = { id: string; name: string; teacherId: string | null };

function ClassEditRow({
  cls,
  teachers,
}: {
  cls: ExistingClass;
  teachers: Teacher[];
}) {
  const [name, setName] = useState(cls.name);
  const [teacherId, setTeacherId] = useState(cls.teacherId ?? '');
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const isDirty = name !== cls.name || teacherId !== (cls.teacherId ?? '');

  function handleSave() {
    if (!name.trim()) return;
    startTransition(async () => {
      await updateClassInfo(cls.id, { name: name.trim(), teacher_id: teacherId || null });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <div className="flex items-center gap-2 py-2">
      <Input
        value={name}
        onChange={(e) => { setName(e.target.value); setSaved(false); }}
        className="h-8 w-32 text-sm shrink-0"
      />
      <select
        className="h-8 rounded-md border border-input bg-background px-2 text-sm flex-1"
        value={teacherId}
        onChange={(e) => { setTeacherId(e.target.value); setSaved(false); }}
      >
        <option value="">— 未指定 —</option>
        {teachers.map((t) => (
          <option key={t.id} value={t.id}>
            {t.english_name ? `${t.name} / ${t.english_name}` : t.name}
          </option>
        ))}
      </select>
      <Button
        size="sm"
        variant="outline"
        disabled={!isDirty || pending || !name.trim()}
        onClick={handleSave}
        className="shrink-0"
      >
        {pending ? '儲存中...' : '儲存'}
      </Button>
      {saved && <span className="text-xs text-green-600 shrink-0">✓</span>}
    </div>
  );
}

export default function InlineAddClassPanel({
  courseId,
  courseCategory,
  teachers,
  existingClasses = [],
}: {
  courseId: string;
  courseCategory: string;
  teachers: Teacher[];
  existingClasses?: ExistingClass[];
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await createClass({
        name,
        campus: '全部校區',
        teacher_id: teacherId || null,
        category: courseCategory,
        program_track: null,
        course_id: courseId,
        academic_year: null,
        term: null,
      });
      setName('');
      setTeacherId('');
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    });
  }

  return (
    <div className="bg-background rounded-xl border shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium hover:bg-muted/30 transition-colors rounded-xl"
      >
        <span>班級設定</span>
        <span className="text-muted-foreground text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t">
          {/* 現有班級老師編輯 */}
          {existingClasses.length > 0 && (
            <div className="px-5 pt-4 pb-3 space-y-1">
              <p className="text-xs text-muted-foreground font-medium mb-2">現有班級 — 帶班老師</p>
              {existingClasses.map((cls) => (
                <ClassEditRow key={cls.id} cls={cls} teachers={teachers} />
              ))}
            </div>
          )}

          {/* 新增班級表單 */}
          <form
            onSubmit={handleSubmit}
            className={`px-5 pb-4 flex flex-wrap gap-3 items-end ${existingClasses.length > 0 ? 'border-t pt-4' : 'pt-4'}`}
          >
            <p className="w-full text-xs text-muted-foreground font-medium -mb-1">新增班級</p>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">班級名稱</p>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例：A 班"
                className="w-44"
                required
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">負責老師</p>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
              >
                <option value="">— 未指定 —</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.english_name ? `${t.name} / ${t.english_name}` : t.name}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={pending || !name}>
              {pending ? '新增中...' : '新增'}
            </Button>
            {done && <span className="text-sm text-green-600">✓ 已新增</span>}
          </form>
        </div>
      )}
    </div>
  );
}
