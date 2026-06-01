import { createServerClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const CAMPUSES = ['文府總校', '龍華校', '左新校'];

const LEAVE_TYPE_COLOR: Record<string, string> = {
  '病假': 'bg-red-50 text-red-700 border-red-200',
  '事假': 'bg-blue-50 text-blue-700 border-blue-200',
  '喪假': 'bg-gray-100 text-gray-700 border-gray-300',
  '活動日': 'bg-purple-50 text-purple-700 border-purple-200',
  '其他': 'bg-muted text-muted-foreground',
};

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

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
  const startDate = `${currentMonth}-01`;
  const endDate = new Date(y, m, 1).toISOString().split('T')[0];

  const { data: leaves } = await supabase
    .from('student_leaves')
    .select('id, leave_date, leave_type, students(name, english_name, campus)')
    .gte('leave_date', startDate)
    .lt('leave_date', endDate)
    .order('leave_date');

  // Filter by campus, then group by date
  const filtered = (leaves ?? []).filter((l: any) =>
    !campus || (l.students as any)?.campus === campus
  );

  const leavesByDate: Record<string, any[]> = {};
  for (const l of filtered) {
    if (!leavesByDate[l.leave_date]) leavesByDate[l.leave_date] = [];
    leavesByDate[l.leave_date].push(l);
  }

  // Calendar grid calculations
  const firstDayOfWeek = new Date(y, m - 1, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(y, m, 0).getDate();
  const totalCells = Math.ceil((firstDayOfWeek + daysInMonth) / 7) * 7;

  // Month navigation helpers
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
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">請假日曆</h1>
        <div className="flex gap-1.5 ml-auto flex-wrap">
          <Link href={campusLink('')}
            className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${!campus ? 'bg-primary text-primary-foreground border-primary' : 'border-input hover:bg-muted'}`}>
            全部
          </Link>
          {CAMPUSES.map((c) => (
            <Link key={c} href={campusLink(c)}
              className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${campus === c ? 'bg-primary text-primary-foreground border-primary' : 'border-input hover:bg-muted'}`}>
              {c}
            </Link>
          ))}
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center gap-3">
        <Link href={monthNav(-1)}
          className="text-sm px-3 py-1.5 rounded-md border border-input hover:bg-muted transition-colors">
          ‹ 上個月
        </Link>
        <span className="text-base font-semibold w-28 text-center">{displayMonth}</span>
        <Link href={monthNav(1)}
          className="text-sm px-3 py-1.5 rounded-md border border-input hover:bg-muted transition-colors">
          下個月 ›
        </Link>
        <span className="text-sm text-muted-foreground ml-2">共 {filtered.length} 筆請假</span>
      </div>

      {/* Calendar grid */}
      <div className="border rounded-lg overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b bg-muted/40">
          {WEEKDAYS.map((wd, i) => (
            <div key={wd}
              className={`py-2 text-center text-xs font-medium ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-muted-foreground'}`}>
              {wd}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {Array.from({ length: totalCells }, (_, i) => {
            const dayNum = i - firstDayOfWeek + 1;
            const isCurrentMonth = dayNum >= 1 && dayNum <= daysInMonth;
            const dateStr = isCurrentMonth
              ? `${currentMonth}-${String(dayNum).padStart(2, '0')}`
              : null;
            const dayLeaves = dateStr ? (leavesByDate[dateStr] ?? []) : [];
            const isToday = dateStr === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const col = i % 7; // 0=Sun, 6=Sat

            return (
              <div key={i}
                className={`min-h-24 p-1.5 border-b border-r last:border-r-0 ${!isCurrentMonth ? 'bg-muted/20' : ''} ${isToday ? 'bg-blue-50/60' : ''}`}>
                {isCurrentMonth && (
                  <>
                    <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full
                      ${isToday ? 'bg-primary text-primary-foreground' : col === 0 ? 'text-red-500' : col === 6 ? 'text-blue-500' : 'text-foreground'}`}>
                      {dayNum}
                    </div>
                    <div className="space-y-1">
                      {dayLeaves.map((l: any) => (
                        <div key={l.id} className="leading-tight">
                          <div className="flex items-center gap-1">
                            <span className="text-xs">{l.students?.name}</span>
                            {l.leave_type && (
                              <span className={`text-[10px] px-1 py-0 rounded border leading-4 shrink-0 ${LEAVE_TYPE_COLOR[l.leave_type] ?? ''}`}>
                                {l.leave_type}
                              </span>
                            )}
                          </div>
                          {(l.students as any)?.english_name && (
                            <div className="text-[10px] text-muted-foreground">
                              {(l.students as any).english_name}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
