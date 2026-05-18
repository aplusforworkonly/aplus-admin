'use client';
import { useRouter } from 'next/navigation';

export type CourseNavEntry = {
  label: string;
  value: string; // comma-joined courseIds
};

export default function CourseSelectorNav({
  entries,
  currentValue,
  tab = 'camp',
  basePath = '/admin/classes/matrix',
}: {
  entries: CourseNavEntry[];
  currentValue: string;
  tab?: string;
  basePath?: string;
}) {
  const router = useRouter();
  return (
    <select
      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
      value={currentValue}
      onChange={(e) =>
        router.push(
          `${basePath}?tab=${tab}&courseIds=${encodeURIComponent(e.target.value)}`
        )
      }
    >
      {entries.map((entry) => (
        <option key={entry.value} value={entry.value}>{entry.label}</option>
      ))}
    </select>
  );
}
