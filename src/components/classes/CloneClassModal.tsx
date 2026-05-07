'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cloneClass } from '@/actions/classes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Teacher = { id: string; name: string; english_name: string | null; department: string | null };

function filterTeachers(teachers: Teacher[], category: string): Teacher[] {
  if (category === 'homeroom') return teachers.filter((t) => t.department === '教學部');
  if (category === 'english_core') return teachers.filter((t) => t.department === '英語部');
  if (category === 'elective') return teachers.filter((t) => t.department === '教學部' || t.department === '英語部');
  return [];
}

function teacherLabel(t: Teacher): string {
  return t.english_name ? `${t.name} / ${t.english_name}` : t.name;
}

type Props = {
  source: {
    id: string;
    name: string;
    campus: string;
    category: string;
    program_track: string | null;
    teacher_id: string | null;
    student_count: number;
  };
  teachers: Teacher[];
  onClose: () => void;
};

const TERMS = ['上學期', '下學期', '夏令營', '冬令營'];

export default function CloneClassModal({ source, teachers, onClose }: Props) {
  const router = useRouter();
  const [name, setName] = useState(source.name);
  const [academicYear, setAcademicYear] = useState('');
  const [term, setTerm] = useState('');
  const [teacherId, setTeacherId] = useState(source.teacher_id ?? '');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const selectCls = 'h-9 rounded-md border border-input bg-background px-3 text-sm w-full';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    startTransition(async () => {
      try {
        await cloneClass(source.id, {
          name,
          campus: source.campus,
          category: source.category,
          program_track: source.program_track,
          teacher_id: teacherId || null,
          academic_year: academicYear || null,
          term: term || null,
        });
        router.refresh();
        onClose();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : '複製失敗');
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-background rounded-lg shadow-lg w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold">升級複製班級</h2>
        <p className="text-sm text-muted-foreground">
          新班級將繼承原班級全部 <span className="font-medium text-foreground">{source.student_count}</span> 位學生名單。
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">班級名稱</p>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">學年度</p>
              <Input value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} placeholder="如 114" />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">學期</p>
              <select className={selectCls} value={term} onChange={(e) => setTerm(e.target.value)}>
                <option value="">— 未指定 —</option>
                {TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">負責老師</p>
            <select className={selectCls} value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
              <option value="">— 未指定 —</option>
              {filterTeachers(teachers, source.category).map((t) => (
                <option key={t.id} value={t.id}>{teacherLabel(t)}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>取消</Button>
            <Button type="submit" disabled={pending || !name}>
              {pending ? '複製中...' : '確認複製'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
