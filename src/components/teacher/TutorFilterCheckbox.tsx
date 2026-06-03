'use client';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export default function TutorFilterCheckbox({ tutorOnly }: { tutorOnly: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(checked: boolean) {
    const params = new URLSearchParams(searchParams.toString());
    if (checked) {
      params.set('tutorOnly', '1');
    } else {
      params.delete('tutorOnly');
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
      <input
        type="checkbox"
        checked={tutorOnly}
        onChange={(e) => handleChange(e.target.checked)}
        className="rounded w-4 h-4 accent-teal-700"
      />
      <span className={tutorOnly ? 'font-medium text-teal-700' : 'text-muted-foreground'}>
        只顯示我負責的學生
      </span>
    </label>
  );
}
