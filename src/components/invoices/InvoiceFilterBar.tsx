'use client';
import { useRouter } from 'next/navigation';

type Props = {
  campuses: string[];
  grades: string[];
  tutors: { id: string; name: string }[];
  current: { status: string; campus: string; grade: string; tutorId: string };
};

export default function InvoiceFilterBar({ campuses, grades, tutors, current }: Props) {
  const router = useRouter();

  function update(key: string, value: string) {
    const params = new URLSearchParams();
    const next = { ...current, [key]: value };
    if (next.status && next.status !== 'all') params.set('status', next.status);
    if (next.campus) params.set('campus', next.campus);
    if (next.grade) params.set('grade', next.grade);
    if (next.tutorId) params.set('tutorId', next.tutorId);
    router.push(`/invoices${params.size > 0 ? '?' + params.toString() : ''}`);
  }

  const cls = 'h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer';

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <select value={current.campus} onChange={(e) => update('campus', e.target.value)} className={cls}>
        <option value="">全部校區</option>
        {campuses.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <select value={current.grade} onChange={(e) => update('grade', e.target.value)} className={cls}>
        <option value="">全部年級</option>
        {grades.map((g) => <option key={g} value={g}>{g}</option>)}
      </select>
      <select value={current.tutorId} onChange={(e) => update('tutorId', e.target.value)} className={cls}>
        <option value="">全部總導師</option>
        {tutors.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
    </div>
  );
}
