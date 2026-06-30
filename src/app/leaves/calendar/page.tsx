import { createServerClient } from '@/lib/supabase/server';
import Link from 'next/link';
import LeaveCalendarGrid, { buildGridDates, type LeavesByDate } from '@/components/leaves/LeaveCalendarGrid';
import { CAMPUSES } from '@/lib/constants';
import PrintButton from '@/components/leaves/PrintButton';
import { getGradeNumber } from '@/lib/grade';

export const dynamic = 'force-dynamic';

const GRADE_OPTIONS = [
  { label: '大班升小一', value: 0 },
  { label: '小一', value: 1 },
  { label: '小二', value: 2 },
  { label: '小三', value: 3 },
  { label: '小四', value: 4 },
  { label: '小五', value: 5 },
  { label: '小六', value: 6 },
];

export default async function LeaveCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; campus?: string; grade?: string }>;
}) {
  const { month, campus, grade } = await searchParams;

  // 支援逗號分隔多選年級，例如 grade=0,1
  const gradeNums: number[] = grade
    ? grade.split(',').map(Number).filter((n) => !isNaN(n))
    : [];

  const supabase = createServerClient();

  const now = new Date();
  const currentMonth = month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [y, m] = currentMonth.split('-').map(Number);

  const { startDate, endDate } = buildGridDates(y, m);

  // 分頁抓取，繞過 Supabase 預設 1000 筆上限
  const allLeaves: any[] = [];
  const PAGE_SIZE = 1000;
  let from = 0;
  while (true) {
    const { data } = await supabase
      .from('student_leaves')
      .select('id, student_id, leave_date, leave_type, students(name, english_name, campus, enrollment_date)')
      .gte('leave_date', startDate)
      .lt('leave_date', endDate)
      .order('leave_date')
      .range(from, from + PAGE_SIZE - 1);
    if (!data || data.length === 0) break;
    allLeaves.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  const leaves = allLeaves;

  const filtered = (leaves ?? []).filter((l: any) => {
    const s = l.students as any;
    if (campus && s?.campus !== campus) return false;
    if (gradeNums.length > 0 && s?.enrollment_date) {
      if (!gradeNums.includes(getGradeNumber(s.enrollment_date))) return false;
    }
    return true;
  });

  // 同一天同一學生只留一筆（student_id 為 null 時 fallback 用 leave id，確保不誤 dedupe）
  const leavesByDate: LeavesByDate = {};
  const seenPerDate: Record<string, Set<string>> = {};
  for (const l of filtered) {
    const date = l.leave_date;
    const dedupKey = (l as any).student_id ?? l.id;
    if (!leavesByDate[date]) {
      leavesByDate[date] = [];
      seenPerDate[date] = new Set();
    }
    if (!seenPerDate[date].has(dedupKey)) {
      seenPerDate[date].add(dedupKey);
      leavesByDate[date].push(l as any);
    }
  }

  function monthNav(delta: number) {
    const d = new Date(y, m - 1 + delta, 1);
    const mo = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const p = new URLSearchParams();
    p.set('month', mo);
    if (campus) p.set('campus', campus);
    if (grade) p.set('grade', grade);
    return `/leaves/calendar?${p}`;
  }

  function campusLink(c: string) {
    const p = new URLSearchParams();
    p.set('month', currentMonth);
    if (c) p.set('campus', c);
    if (grade) p.set('grade', grade);
    return `/leaves/calendar?${p}`;
  }

  // 點選某個年級 → 切換加入/移除，同時保留其他已選年級
  function gradeToggleLink(g: number | null) {
    const p = new URLSearchParams();
    p.set('month', currentMonth);
    if (campus) p.set('campus', campus);
    if (g === null) {
      // 清除全部年級篩選
    } else {
      const next = gradeNums.includes(g)
        ? gradeNums.filter((n) => n !== g)
        : [...gradeNums, g];
      if (next.length > 0) p.set('grade', next.join(','));
    }
    return `/leaves/calendar?${p}`;
  }

  const displayMonth = `${y} 年 ${m} 月`;
  const gradeLabel =
    gradeNums.length === 0
      ? '全部年級'
      : gradeNums
          .sort((a, b) => a - b)
          .map((n) => GRADE_OPTIONS.find((o) => o.value === n)?.label ?? '')
          .join('、');

  const totalShown = Object.values(leavesByDate).reduce((s, arr) => s + arr.length, 0);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">請假日曆</h1>
        <div className="flex gap-1.5 ml-auto flex-wrap print:hidden">
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

      {/* 年級篩選（多選） */}
      <div className="flex gap-1.5 flex-wrap print:hidden">
        <Link
          href={gradeToggleLink(null)}
          className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${gradeNums.length === 0 ? 'bg-primary text-primary-foreground border-primary' : 'border-input hover:bg-muted'}`}
        >
          全部年級
        </Link>
        {GRADE_OPTIONS.map((o) => (
          <Link
            key={o.value}
            href={gradeToggleLink(o.value)}
            className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${gradeNums.includes(o.value) ? 'bg-primary text-primary-foreground border-primary' : 'border-input hover:bg-muted'}`}
          >
            {o.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Link href={monthNav(-1)} className="print:hidden text-sm px-3 py-1.5 rounded-md border border-input hover:bg-muted transition-colors">
          ‹ 上個月
        </Link>
        <span className="text-base font-semibold w-28 text-center">{displayMonth}</span>
        <Link href={monthNav(1)} className="print:hidden text-sm px-3 py-1.5 rounded-md border border-input hover:bg-muted transition-colors">
          下個月 ›
        </Link>
        <span className="print:hidden text-sm text-muted-foreground ml-2">共 {totalShown} 人次</span>
        <span className="hidden print:inline text-sm text-muted-foreground ml-2">
          {campus || '全部校區'} · {gradeLabel} · 共 {totalShown} 人次
        </span>
        <PrintButton />
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
