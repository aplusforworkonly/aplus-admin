'use client';
import { useState, useTransition } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DailyTimeline } from './DailyTimeline';
import { WeeklyTimeline } from './WeeklyTimeline';
import { getStudentDailySchedule, getStudentWeeklySchedule } from '@/actions/schedules';
import type { ScheduleSlot } from '@/lib/supabase/types';

type View = 'day' | 'week';

function offsetDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return [
    dt.getFullYear(),
    String(dt.getMonth() + 1).padStart(2, '0'),
    String(dt.getDate()).padStart(2, '0'),
  ].join('-');
}

function getWeekStart(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = dt.getDay(); // 0=Sun
  const diff = dow === 0 ? -6 : 1 - dow;
  return offsetDate(dateStr, diff);
}

function formatWeekRange(weekStart: string): string {
  const end = offsetDate(weekStart, 4); // Friday
  const [sy, sm, sd] = weekStart.split('-').map(Number);
  const [, em, ed] = end.split('-').map(Number);
  if (sm === em) return `${sy}年${sm}月${sd}–${ed}日`;
  return `${sy}年${sm}月${sd}日–${em}月${ed}日`;
}

export function StudentSchedulePanel({
  studentId,
  initialDate,
  initialSlots,
}: {
  studentId: string;
  initialDate: string;
  initialSlots: ScheduleSlot[];
}) {
  const [view, setView] = useState<View>('day');
  const [date, setDate] = useState(initialDate);
  const [slots, setSlots] = useState(initialSlots);
  const [weekDays, setWeekDays] = useState<{ date: string; slots: ScheduleSlot[] }[]>([]);
  const [isPending, startTransition] = useTransition();

  const weekStart = getWeekStart(date);

  function loadDay(newDate: string) {
    startTransition(async () => {
      const newSlots = await getStudentDailySchedule(studentId, newDate);
      setDate(newDate);
      setSlots(newSlots);
    });
  }

  function loadWeek(anyDateInWeek: string) {
    const ws = getWeekStart(anyDateInWeek);
    startTransition(async () => {
      const days = await getStudentWeeklySchedule(studentId, ws);
      setDate(anyDateInWeek);
      setWeekDays(days);
    });
  }

  function navigate(delta: number) {
    if (view === 'day') loadDay(offsetDate(date, delta));
    else loadWeek(offsetDate(date, delta * 7));
  }

  function onDatePick(newDate: string) {
    if (!newDate) return;
    if (view === 'day') loadDay(newDate);
    else loadWeek(newDate);
  }

  function switchView(newView: View) {
    if (newView === view) return;
    setView(newView);
    if (newView === 'week' && weekDays.length === 0) {
      startTransition(async () => {
        const days = await getStudentWeeklySchedule(studentId, weekStart);
        setWeekDays(days);
      });
    }
  }

  return (
    <div className="space-y-3">
      {/* 控制列 */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* 日 / 週 切換 */}
        <div className="flex rounded-md border overflow-hidden text-xs">
          <button
            onClick={() => switchView('day')}
            disabled={isPending}
            className={`px-3 py-1.5 font-medium transition-colors ${
              view === 'day'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            日
          </button>
          <button
            onClick={() => switchView('week')}
            disabled={isPending}
            className={`px-3 py-1.5 font-medium transition-colors border-l ${
              view === 'week'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            週
          </button>
        </div>

        {/* 前後導覽 */}
        <Button variant="outline" size="sm" onClick={() => navigate(-1)} disabled={isPending}>
          <ChevronLeft className="w-4 h-4" />
        </Button>

        {/* 日期選擇器 */}
        <input
          type="date"
          value={date}
          onChange={(e) => onDatePick(e.target.value)}
          disabled={isPending}
          className="h-8 px-2 text-xs border rounded-md bg-background text-foreground disabled:opacity-50 cursor-pointer"
        />

        <Button variant="outline" size="sm" onClick={() => navigate(1)} disabled={isPending}>
          <ChevronRight className="w-4 h-4" />
        </Button>

        {view === 'week' && (
          <span className="text-xs text-muted-foreground">{formatWeekRange(weekStart)}</span>
        )}

        {isPending && <span className="text-xs text-muted-foreground">載入中…</span>}
      </div>

      {/* 時間軸 */}
      <div style={{ opacity: isPending ? 0.5 : 1, transition: 'opacity 0.15s' }}>
        {view === 'day' ? (
          <DailyTimeline slots={slots} date={date} mode="student" />
        ) : weekDays.length > 0 ? (
          <WeeklyTimeline days={weekDays} />
        ) : (
          <div className="text-xs text-muted-foreground py-12 text-center">載入中…</div>
        )}
      </div>
    </div>
  );
}
