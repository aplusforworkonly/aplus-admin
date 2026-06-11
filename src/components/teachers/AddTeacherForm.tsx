'use client';
import { useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { createTeacher } from '@/actions/teachers';
import { CAMPUSES } from '@/lib/constants';


export default function AddTeacherForm() {
  const [name, setName] = useState('');
  const [englishName, setEnglishName] = useState('');
  const [email, setEmail] = useState('');
  const [campus, setCampus] = useState('文府總校');
  const [department, setDepartment] = useState('');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    startTransition(async () => {
      try {
        await createTeacher({
          name,
          email,
          campus,
          english_name: englishName || undefined,
          department: department || undefined,
        });
        setName(''); setEnglishName(''); setEmail(''); setDepartment('');
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : '新增失敗');
      }
    });
  }

  const selectCls = 'h-9 rounded-md border border-input bg-background px-3 text-sm';

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-end flex-wrap">
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">姓名</p>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="王小明" className="w-24" required />
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">英文名字</p>
        <Input value={englishName} onChange={(e) => setEnglishName(e.target.value)} placeholder="Xiao Ming" className="w-32" />
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Google Email</p>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teacher@gmail.com" className="w-52" required />
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">校區</p>
        <select className={selectCls} value={campus} onChange={(e) => setCampus(e.target.value)}>
          {CAMPUSES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">部門</p>
        <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="英語部" className="w-28" />
      </div>
      <Button type="submit" disabled={pending}>新增老師</Button>
      {error && <p className="text-sm text-destructive w-full">{error}</p>}
    </form>
  );
}
