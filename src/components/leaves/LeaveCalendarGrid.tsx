const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

const LEAVE_TYPE_COLOR: Record<string, string> = {
  '病假': 'bg-red-50 text-red-700 border-red-200',
  '事假': 'bg-blue-50 text-blue-700 border-blue-200',
  '喪假': 'bg-gray-100 text-gray-700 border-gray-300',
  '活動日': 'bg-purple-50 text-purple-700 border-purple-200',
  '其他': 'bg-muted text-muted-foreground',
};

export type LeaveEntry = {
  id: string;
  leave_date: string;
  leave_type: string | null;
  students: { name: string; english_name: string | null } | null;
};

export type LeavesByDate = Record<string, LeaveEntry[]>;

export function buildGridDates(y: number, m: number): {
  firstDayOfWeek: number;
  daysInMonth: number;
  totalCells: number;
  startDate: string;
  endDate: string;
} {
  const firstDayOfWeek = new Date(y, m - 1, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(y, m, 0).getDate();
  const totalCells = Math.ceil((firstDayOfWeek + daysInMonth) / 7) * 7;

  // 網格起始：可能是上個月底（firstDayOfWeek > 0 時往前推）
  const gridStart = new Date(y, m - 1, 1 - firstDayOfWeek);
  // 網格結束（exclusive）：網格最後一天的隔天
  const gridEnd = new Date(y, m - 1, totalCells - firstDayOfWeek + 1);

  return {
    firstDayOfWeek,
    daysInMonth,
    totalCells,
    startDate: gridStart.toISOString().split('T')[0],
    endDate: gridEnd.toISOString().split('T')[0],
  };
}

export default function LeaveCalendarGrid({
  leavesByDate,
  currentMonth,
  y,
  m,
}: {
  leavesByDate: LeavesByDate;
  currentMonth: string;
  y: number;
  m: number;
}) {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const { firstDayOfWeek, daysInMonth, totalCells } = buildGridDates(y, m);

  return (
    <div className="overflow-x-auto">
      <div className="border rounded-lg overflow-hidden min-w-[560px]">
        {/* 星期標頭 */}
        <div className="grid grid-cols-7 border-b bg-muted/40">
          {WEEKDAYS.map((wd, i) => (
            <div
              key={wd}
              className={`py-2 text-center text-xs font-medium ${
                i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-muted-foreground'
              }`}
            >
              {wd}
            </div>
          ))}
        </div>

        {/* 日期格子 */}
        <div className="grid grid-cols-7">
          {Array.from({ length: totalCells }, (_, i) => {
            const dayNum = i - firstDayOfWeek + 1;
            const isCurrentMonth = dayNum >= 1 && dayNum <= daysInMonth;
            const dateStr = isCurrentMonth
              ? `${currentMonth}-${String(dayNum).padStart(2, '0')}`
              : null;
            const dayLeaves = dateStr ? (leavesByDate[dateStr] ?? []) : [];
            const isToday = dateStr === todayStr;
            const col = i % 7;

            return (
              <div
                key={i}
                className={`h-32 sm:h-40 p-1 sm:p-1.5 border-b border-r last:border-r-0 flex flex-col ${
                  !isCurrentMonth ? 'bg-muted/20' : ''
                } ${isToday ? 'bg-blue-50/60' : ''}`}
              >
                {isCurrentMonth && (
                  <>
                    <div
                      className={`text-xs font-medium mb-0.5 w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-full shrink-0 ${
                        isToday
                          ? 'bg-primary text-primary-foreground'
                          : col === 0
                          ? 'text-red-500'
                          : col === 6
                          ? 'text-blue-500'
                          : 'text-foreground'
                      }`}
                    >
                      {dayNum}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-1 gap-y-0 sm:gap-y-0.5 overflow-y-auto flex-1 min-h-0 pr-0.5">
                      {dayLeaves.map((l) => (
                        <div key={l.id} className="leading-tight min-w-0">
                          <div className="flex items-center gap-0.5 min-w-0">
                            <span className="text-[10px] sm:text-xs truncate">{l.students?.name}</span>
                            {l.leave_type && (
                              <span
                                className={`hidden sm:inline text-[10px] px-1 py-0 rounded border leading-4 shrink-0 ${
                                  LEAVE_TYPE_COLOR[l.leave_type] ?? ''
                                }`}
                              >
                                {l.leave_type}
                              </span>
                            )}
                          </div>
                          {l.students?.english_name && (
                            <div className="text-[10px] text-muted-foreground truncate">
                              {l.students.english_name}
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
