'use client';
import { useRouter, usePathname } from 'next/navigation';
import { Eye } from 'lucide-react';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel,
  SelectSeparator, SelectTrigger, SelectValue,
} from '@/components/ui/select';

type Teacher = { id: string; name: string; campus: string };

interface Props {
  allTeachers: Teacher[];
  selfId: string;
  currentViewId: string;
}

export default function TeacherViewSwitcher({ allTeachers, selfId, currentViewId }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const selfCampus = allTeachers.find(t => t.id === selfId)?.campus;
  const sameCampus = allTeachers.filter(t => t.id !== selfId && t.campus === selfCampus);
  const otherCampus = allTeachers.filter(t => t.id !== selfId && t.campus !== selfCampus);

  function handleChange(value: string | null) {
    if (!value || value === selfId) {
      router.replace(pathname);
    } else {
      router.replace(`${pathname}?view=${value}`);
    }
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
      <Eye className="w-4 h-4 text-amber-600 shrink-0" />
      <span className="text-sm text-amber-700 font-medium shrink-0">督導模式</span>
      <Select value={currentViewId} onValueChange={handleChange}>
        <SelectTrigger className="flex-1 h-8 text-sm bg-white">
          <SelectValue placeholder="選擇老師…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={selfId}>我自己</SelectItem>
          <SelectSeparator />
          {sameCampus.length > 0 && (
            <SelectGroup>
              <SelectLabel>{selfCampus}</SelectLabel>
              {sameCampus.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectGroup>
          )}
          {otherCampus.length > 0 && (
            <>
              {sameCampus.length > 0 && <SelectSeparator />}
              <SelectGroup>
                <SelectLabel>其他校區</SelectLabel>
                {otherCampus.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}　{t.campus}</SelectItem>
                ))}
              </SelectGroup>
            </>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
