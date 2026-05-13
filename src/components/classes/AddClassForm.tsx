'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClass } from '@/actions/classes';

const CAMPUSES = ['全部校區', '文府總校', '龍華校', '左新校'];
const CATEGORIES = [
  { value: 'homeroom', label: '教學班' },
  { value: 'english_core', label: '英語核心' },
  { value: 'elective', label: '選修' },
  { value: 'camp', label: '冬夏令營課程' },
];

type Teacher = { id: string; name: string; english_name: string | null; department: string | null };
type Course = { id: string; name: string };

function filterTeachers(teachers: Teacher[], category: string): Teacher[] {
  if (category === 'homeroom') return teachers.filter((t) => t.department === '教學部');
  if (category === 'english_core') return teachers.filter((t) => t.department === '英語部');
  if (category === 'elective' || category === 'camp') return teachers.filter((t) => t.department === '教學部' || t.department === '英語部');
  return [];
}

function teacherLabel(t: Teacher): string {
  return t.english_name ? `${t.name} / ${t.english_name}` : t.name;
}

export default function AddClassForm({
  teachers,
  courses,
}: {
  teachers: Teacher[];
  courses: Course[];
}) {
  const [name, setName] = useState('');
  const [campus, setCampus] = useState('全部校區');
  const [teacherId, setTeacherId] = useState('');
  const [category, setCategory] = useState('homeroom');
  const [programTrack, setProgramTrack] = useState('');
  const [courseId, setCourseId] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [term, setTerm] = useState('');
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await createClass({
        name,
        campus,
        teacher_id: teacherId || null,
        category,
        program_track: category === 'english_core' ? programTrack || null : null,
        course_id: courseId || null,
        academic_year: academicYear || null,
        term: term || null,
      });
      setName('');
      setProgramTrack('');
      setCourseId('');
      setAcademicYear('');
      setTerm('');
    });
  }

  const selectCls = 'h-9 rounded-md border border-input bg-background px-3 text-sm';

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">班級名稱</p>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例：夏令營教學1班"
          className="w-48"
          required
        />
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">校區</p>
        <select className={selectCls} value={campus} onChange={(e) => setCampus(e.target.value)}>
          {CAMPUSES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">類別</p>
        <select className={selectCls} value={category} onChange={(e) => { setCategory(e.target.value); setTeacherId(''); }}>
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>
      {category === 'english_core' && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">大班系</p>
          <Input
            value={programTrack}
            onChange={(e) => setProgramTrack(e.target.value)}
            placeholder="如 FAE、FPE"
            className="w-28"
          />
        </div>
      )}
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">負責老師</p>
        <select className={selectCls} value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
          <option value="">— 未指定 —</option>
          {filterTeachers(teachers, category).map((t) => (
            <option key={t.id} value={t.id}>{teacherLabel(t)}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">對應課程（選填）</p>
        <select className={selectCls} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          <option value="">— 未連結 —</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">學年度（選填）</p>
        <Input
          value={academicYear}
          onChange={(e) => setAcademicYear(e.target.value)}
          placeholder="如 114"
          className="w-20"
        />
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">學期（選填）</p>
        <select className={selectCls} value={term} onChange={(e) => setTerm(e.target.value)}>
          <option value="">— 未指定 —</option>
          <option value="上學期">上學期</option>
          <option value="下學期">下學期</option>
          <option value="夏令營">夏令營</option>
          <option value="冬令營">冬令營</option>
        </select>
      </div>
      <Button type="submit" disabled={pending || !name}>
        {pending ? '新增中...' : '新增班級'}
      </Button>
    </form>
  );
}
