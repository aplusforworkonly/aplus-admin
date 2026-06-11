'use client';
import type { ScheduleSlot } from '@/lib/supabase/types';

const TIMELINE_START_MIN = 8 * 60;
const TIMELINE_TOTAL_MIN = 10 * 60;
const TRACK_HEIGHT_PX = 560;
const HOURS = Array.from({ length: 11 }, (_, i) => i + 8);

function toPercent(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  const raw = ((h * 60 + m - TIMELINE_START_MIN) / TIMELINE_TOTAL_MIN) * 100;
  return Math.max(0, Math.min(100, raw));
}

function formatTime(t: string) {
  return t.slice(0, 5);
}

// 剝除 "X/X–X/X｜" 或 "X/X-X/X|" 開頭的日期前綴，只留課程本名
function shortCourseName(name: string): string {
  return name.replace(/^\d+\/\d+[–\-~～]\d+\/\d+\s*[｜|]\s*/, '').trim() || name;
}

export function WeeklyTimeline({
  days,
}: {
  days: { date: string; slots: ScheduleSlot[] }[];
}) {
  return (
    <div className="overflow-x-auto">
      <div className="flex gap-0 min-w-max">
        {/* 左側時間軸 */}
        <div className="flex-shrink-0 w-12">
          <div className="h-12" /> {/* 對齊欄標題 */}
          <div className="relative" style={{ height: TRACK_HEIGHT_PX }}>
            {HOURS.map((h) => (
              <div
                key={h}
                className="absolute right-0 flex items-center"
                style={{ top: `${toPercent(`${h}:00`)}%`, transform: 'translateY(-50%)' }}
              >
                <span className="text-[10px] text-gray-400 pr-1 tabular-nums">
                  {String(h).padStart(2, '0')}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 每天一欄 */}
        {days.map(({ date, slots }) => {
          const [y, m, d] = date.split('-').map(Number);
          const dow = new Date(y, m - 1, d).getDay();
          const dayLabel = ['日', '一', '二', '三', '四', '五', '六'][dow];
          const isWeekend = dow === 0 || dow === 6;

          return (
            <div
              key={date}
              className={`flex-shrink-0 w-28 border-l border-gray-200 ${isWeekend ? 'bg-slate-50/60' : ''}`}
            >
              {/* 欄標題 */}
              <div className="h-12 px-2 flex flex-col justify-center border-b border-gray-200 bg-gray-50">
                <p className="text-xs font-semibold text-gray-700 leading-tight">週{dayLabel}</p>
                <p className="text-xs text-gray-400 leading-tight">{m}/{d}</p>
              </div>

              {/* 時間軌道 */}
              <div className="relative" style={{ height: TRACK_HEIGHT_PX }}>
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-t border-gray-100 pointer-events-none"
                    style={{ top: `${toPercent(`${h}:00`)}%` }}
                  />
                ))}

                {slots.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[11px] text-gray-300">無課</span>
                  </div>
                )}

                {slots.map((slot, i) => {
                  const top = toPercent(slot.start_time);
                  const height = Math.max(2, toPercent(slot.end_time) - top);
                  return (
                    <div
                      key={i}
                      className="absolute left-1 right-1 bg-blue-50 border border-blue-300 rounded-md px-1.5 py-1 overflow-hidden"
                      style={{ top: `${top}%`, height: `${height}%` }}
                    >
                      <p className="text-[11px] font-semibold text-blue-800 truncate leading-tight">
                        {shortCourseName(slot.course_name)}
                      </p>
                      <p className="text-[10px] text-blue-400 leading-tight">
                        時間 {formatTime(slot.start_time)}–{formatTime(slot.end_time)}
                      </p>
                      {slot.location && (
                        <p className="text-[10px] text-blue-500 font-mono leading-tight">
                          教室 {slot.location}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
