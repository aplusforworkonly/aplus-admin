'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { CAMPUSES } from '@/lib/constants';

const TERMS = ['上學期', '下學期', '夏令營', '冬令營'];

export default function ClassFilters({ years }: { years: string[] }) {
  const router = useRouter();
  const params = useSearchParams();

  const tab = params.get('tab') ?? 'active';
  const year = params.get('year') ?? '';
  const term = params.get('term') ?? '';
  const campus = params.get('campus') ?? '';

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'tab') next.delete('tab');
    router.push(`?${next.toString()}`);
  }

  function setTab(t: string) {
    const next = new URLSearchParams(params.toString());
    if (t === 'active') next.delete('tab');
    else next.set('tab', t);
    router.push(`?${next.toString()}`);
  }

  const selectCls = 'h-8 rounded-md border border-input bg-background px-2 text-sm';

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex rounded-md border border-input overflow-hidden text-sm">
        <button
          onClick={() => setTab('active')}
          className={`px-3 py-1.5 ${tab !== 'archived' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
        >
          啟用中
        </button>
        <button
          onClick={() => setTab('archived')}
          className={`px-3 py-1.5 border-l border-input ${tab === 'archived' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
        >
          已封存
        </button>
      </div>
      <select className={selectCls} value={year} onChange={(e) => update('year', e.target.value)}>
        <option value="">全部學年度</option>
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
      <select className={selectCls} value={term} onChange={(e) => update('term', e.target.value)}>
        <option value="">全部學期</option>
        {TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <select className={selectCls} value={campus} onChange={(e) => update('campus', e.target.value)}>
        <option value="">全部校區</option>
        {CAMPUSES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  );
}
