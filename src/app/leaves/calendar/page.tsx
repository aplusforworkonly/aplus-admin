import { createServerClient } from '@/lib/supabase/server';
import Link from 'next/link';
import LeaveCalendarGrid, { buildGridDates, type LeavesByDate } from '@/components/leaves/LeaveCalendarGrid';
import { CAMPUSES } from '@/lib/constants';

export const dynamic = 'force-dynamic';


export default async function LeaveCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; campus?: string }>;
}) {
  const { month, campus } = await searchParams;
  const supabase = createServerClient();

  const now = new Date();
  const currentMonth = month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [y, m] = currentMonth.split('-').map(Number);

  // 查詢範圍涵蓋完整日曆網格（含跨月頭尾格子）
  const { startDate, endDate } = buildGridDates(y, m);

  const { data: leaves } = await supabase
    .from('student_leaves')
    .select('id, leave_date, leave_type, students(name, english_name, campus, enrollment_date)')
    .gte('leave_date', startDate)
    .lt('leave_date', endDate)
    .order('leave_date');

  const filtered = (leaves ?? []).filter((l: any) =>
    !campus || (l.students as any)?.campus === campus
  );

  const leavesByDate: LeavesByDate = {};
  for (const l of filtered) {
    if (!leavesByDate[l.leave_date]) leavesByDate[l.leave_date] = [];
    leavesByDate[l.leave_date].push(l as any);
  }

  function monthNav(delta: number) {
    const d = new Date(y, m - 1 + delta, 1);
    const mo = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const p = new URLSearchParams();
    p.set('month', mo);
    if (campus) p.set('campus', campus);
    return `/leaves/calendar?${p}`;
  }

  function campusLink(c: string) {
    const p = new URLSearchParams();
    p.set('month', currentMonth);
    if (c) p.set('campus', c);
    return `/leaves/calendar?${p}`;
  }

  const displayMonth = `${y} 年 ${m} 月`;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">請假日曆</h1>
        <div className="flex gap-1.5 ml-auto flex-wrap">
          <Link
            href={campusLink('')}
            className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${!campus ? 'bg-primary text-primary-foreground border-primary' : 'border-input hover:bg-muted'}`}
          >
            全部
          </Link>
          {CAMPUSES.map((c) => (
            <Link
              key={c}
              href={campusLink(c)}
              className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${campus === c ? 'bg-primary text-primary-foreground border-primary' : 'border-input hover:bg-muted'}`}
            >
              {c}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Link href={monthNav(-1)} className="text-sm px-3 py-1.5 rounded-md border border-input hover:bg-muted transition-colors">
          ‹ 上個月
        </Link>
        <span className="text-base font-semibold w-28 text-center">{displayMonth}</span>
        <Link href={monthNav(1)} className="text-sm px-3 py-1.5 rounded-md border border-input hover:bg-muted transition-colors">
          下個月 ›
        </Link>
        <span className="text-sm text-muted-foreground ml-2">共 {filtered.length} 筆請假</span>
      </div>

      <LeaveCalendarGrid
        leavesByDate={leavesByDate}
        currentMonth={currentMonth}
        y={y}
        m={m}
      />
    </div>
  );
}
