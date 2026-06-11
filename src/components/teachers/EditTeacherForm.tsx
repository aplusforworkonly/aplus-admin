'use client';
import { useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { updateTeacher } from '@/actions/teachers';
import { CAMPUSES } from '@/lib/constants';


type Teacher = {
  id: string;
  name: string;
  english_name: string | null;
  email: string;
  campus: string | null;
  department: string | null;
  status: string;
};

export default function EditTeacherForm({ teacher }: { teacher: Teacher }) {
  const [name, setName] = useState(teacher.name);
  const [englishName, setEnglishName] = useState(teacher.english_name ?? '');
  const [email, setEmail] = useState(teacher.email);
  const [campus, setCampus] = useState(teacher.campus ?? '文府總校');
  const [department, setDepartment] = useState(teacher.department ?? '');
  const [status, setStatus] = useState(teacher.status ?? '在職');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaved(false);
    startTransition(async () => {
      try {
        await updateTeacher(teacher.id, {
          name,
          english_name: englishName || null,
          email,
          campus,
          department: department || null,
          status,
        });
        setSaved(true);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : '儲存失敗');
      }
    });
  }

  const selectCls = 'h-9 rounded-md border border-input bg-background px-3 text-sm w-full';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>姓名</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label>英文名字</Label>
          <Input value={englishName} onChange={(e) => setEnglishName(e.target.value)} placeholder="Xiao Ming" />
        </div>
        <div className="space-y-1.5">
          <Label>Google Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label>部門</Label>
          <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="英語部" />
        </div>
        <div className="space-y-1.5">
          <Label>校區</Label>
          <select className={selectCls} value={campus} onChange={(e) => setCampus(e.target.value)}>
            {CAMPUSES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>狀態</Label>
          <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="在職">在職</option>
            <option value="離職">離職</option>
          </select>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>儲存</Button>
        {saved && <span className="text-sm text-green-700">已儲存</span>}
      </div>
    </form>
  );
}
