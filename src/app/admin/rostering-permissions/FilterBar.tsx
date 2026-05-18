'use client';
import { useRouter, useSearchParams } from 'next/navigation';

export default function FilterBar({
  campuses,
  departments,
}: {
  campuses: string[];
  departments: string[];
}) {
  const router = useRouter();
  const sp = useSearchParams();

  function update(key: string, value: string) {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/admin/rostering-permissions?${params.toString()}`);
  }

  const selectClass =
    'text-sm border border-input rounded-md px-3 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring';

  return (
    <div className="flex gap-3 flex-wrap">
      <select
        value={sp.get('campus') ?? ''}
        onChange={(e) => update('campus', e.target.value)}
        className={selectClass}
      >
        <option value="">所有校區</option>
        {campuses.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      <select
        value={sp.get('dept') ?? ''}
        onChange={(e) => update('dept', e.target.value)}
        className={selectClass}
      >
        <option value="">所有部門</option>
        {departments.map((d) => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>
    </div>
  );
}
