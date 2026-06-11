'use client';
import type { ScheduleSlot, AdminScheduleSlot } from '@/lib/supabase/types';

// ── 時間軸設定 ────────────────────────────────────────────────
const TIMELINE_START_MIN = 8 * 60;   // 08:00 = 0%
const TIMELINE_TOTAL_MIN = 10 * 60;  // 18:00 = 100%（共 600 分鐘）
const TRACK_HEIGHT_PX    = 600;
const HOURS = Array.from({ length: 11 }, (_, i) => i + 8); // 8 ~ 18

/**
 * 將時間字串（'HH:MM' 或 'HH:MM:SS'）轉為時間軸百分比。
 * - 08:00 → 0%，18:00 → 100%
 * - 超出範圍時 clamp 到 [0, 100]，避免色塊爆出容器
 */
function toPercent(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  const raw = ((h * 60 + m - TIMELINE_START_MIN) / TIMELINE_TOTAL_MIN) * 100;
  return Math.max(0, Math.min(100, raw));
}

function formatTime(timeStr: string): string {
  return timeStr.slice(0, 5); // 'HH:MM:SS' → 'HH:MM'
}

const WEEKDAY_ZH = ['日', '一', '二', '三', '四', '五', '六'];

function formatDateLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return `${y}年${m}月${d}日 星期${WEEKDAY_ZH[dow]}`;
}

// ── 共用：左側時間刻度軸 ─────────────────────────────────────

function TimeAxis() {
  return (
    <div className="relative flex-shrink-0 w-14" style={{ height: TRACK_HEIGHT_PX }}>
      {HOURS.map((h) => (
        <div
          key={h}
          className="absolute right-0 flex items-center"
          style={{ top: `${toPercent(`${h}:00`)}%`, transform: 'translateY(-50%)' }}
        >
          <span className="text-xs text-gray-400 pr-2 tabular-nums">
            {String(h).padStart(2, '0')}:00
          </span>
        </div>
      ))}
    </div>
  );
}

// ── 共用：時間刻度橫線 ────────────────────────────────────────

function HourLines() {
  return (
    <>
      {HOURS.map((h) => (
        <div
          key={h}
          className="absolute left-0 right-0 border-t border-gray-100 pointer-events-none"
          style={{ top: `${toPercent(`${h}:00`)}%` }}
        />
      ))}
    </>
  );
}

// ── Props ─────────────────────────────────────────────────────

interface StudentTimelineProps {
  slots: ScheduleSlot[];
  date: string;
  mode: 'student';
}

interface AdminTimelineProps {
  slots: AdminScheduleSlot[];
  date: string;
  mode: 'admin';
}

type DailyTimelineProps = StudentTimelineProps | AdminTimelineProps;

// ── 主元件 ────────────────────────────────────────────────────

export function DailyTimeline(props: DailyTimelineProps) {
  const { slots, date, mode } = props;

  if (slots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <p className="text-sm">{formatDateLabel(date)}</p>
        <p className="mt-2">今日無課</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">{formatDateLabel(date)}</p>
      {mode === 'student'
        ? <StudentTrack slots={slots as ScheduleSlot[]} />
        : <AdminTrack  slots={slots as AdminScheduleSlot[]} />
      }
    </div>
  );
}

// ── Student mode：單一垂直軌道 ────────────────────────────────

function StudentTrack({ slots }: { slots: ScheduleSlot[] }) {
  return (
    <div className="flex gap-1">
      <TimeAxis />
      <div
        className="relative flex-1 border-l border-gray-200"
        style={{ height: TRACK_HEIGHT_PX }}
      >
        <HourLines />
        {slots.map((slot) => {
          const top    = toPercent(slot.start_time);
          const height = Math.max(1.5, toPercent(slot.end_time) - top);
          return (
            <div
              key={slot.class_id}
              className="absolute left-1 right-1 bg-blue-50 border border-blue-300 rounded-md px-2 py-1 overflow-hidden"
              style={{ top: `${top}%`, height: `${height}%` }}
            >
              <p className="text-xs font-semibold text-blue-800 truncate leading-tight">
                {slot.course_name}
              </p>
              <p className="text-xs text-blue-600 truncate leading-tight">{slot.class_name}</p>
              <p className="text-xs text-blue-400 leading-tight">
                {formatTime(slot.start_time)}–{formatTime(slot.end_time)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Admin mode：每班一欄，Flex 並排，禁止疊死 ────────────────

function AdminTrack({ slots }: { slots: AdminScheduleSlot[] }) {
  // 每個 class_id 獨立一欄
  const classIds = Array.from(new Set(slots.map((s) => s.class_id)));
  const columns = classIds.map((cid) => {
    const colSlots = slots.filter((s) => s.class_id === cid);
    const first    = colSlots[0];
    return {
      class_id:    cid,
      class_name:  first.class_name,
      campus:      first.campus,
      enrolled_count: first.enrolled_count,
      slots:       colSlots,
    };
  });

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-0 min-w-max">
        {/* 左側時間軸 */}
        <div className="flex-shrink-0">
          <div className="h-10" /> {/* header 佔位 */}
          <TimeAxis />
        </div>

        {/* 每個班級獨立一欄 */}
        {columns.map((col) => (
          <div
            key={col.class_id}
            className="flex-shrink-0 w-36 border-l border-gray-200"
          >
            {/* 欄標題 */}
            <div className="h-10 px-2 flex flex-col justify-center border-b border-gray-200 bg-gray-50">
              <p className="text-xs font-medium text-gray-700 truncate leading-tight">
                {col.class_name}
              </p>
              <p className="text-xs text-gray-400 truncate leading-tight">
                {col.campus} · {col.enrolled_count} 人
              </p>
            </div>

            {/* 時間軸軌道 */}
            <div
              className="relative"
              style={{ height: TRACK_HEIGHT_PX }}
            >
              <HourLines />
              {col.slots.map((slot, i) => {
                const top    = toPercent(slot.start_time);
                const height = Math.max(1.5, toPercent(slot.end_time) - top);
                return (
                  <div
                    key={i}
                    className="absolute left-1 right-1 bg-indigo-50 border border-indigo-300 rounded-md px-1.5 py-1 overflow-hidden"
                    style={{ top: `${top}%`, height: `${height}%` }}
                  >
                    <p className="text-xs font-semibold text-indigo-800 truncate leading-tight">
                      {slot.course_name}
                    </p>
                    <p className="text-xs text-indigo-400 leading-tight">
                      {formatTime(slot.start_time)}–{formatTime(slot.end_time)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
