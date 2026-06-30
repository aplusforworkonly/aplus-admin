import { getGradeShort } from '@/lib/grade';

const WEEKDAYS = ['一', '二', '三', '四', '五'];

const LEAVE_TYPE_COLOR: Record<string, string> = {
  '病假': 'bg-red-50 text-red-700 border-red-200',
  '事假': 'bg-blue-50 text-blue-700 border-blue-200',
  '喪假': 'bg-gray-100 text-gray-700 border-gray-300',
  '活動日': 'bg-purple-50 text-purple-700 border-purple-200',
  '其他': 'bg-muted text-muted-foreground',
};

export type LeaveEntry = {
  id: string;
  student_id: string;
  leave_date: string;
  leave_type: string | null;
  students: { name: string; english_name: string | null; enrollment_date: string | null } | null;
};

export type LeavesByDate = Record<string, LeaveEntry[]>;

// 保留此 export 供 page.tsx 計算 Supabase 查詢範圍使用
export function buildGridDates(y: number, m: number): {
  firstDayOfWeek: number;
  daysInMonth: number;
  totalCells: number;
  startDate: string;
  endDate: string;
} {
  const firstDayOfWeek = new Date(y, m - 1, 1).getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const totalCells = Math.ceil((firstDayOfWeek + daysInMonth) / 7) * 7;
  const gridStart = new Date(y, m - 1, 1 - firstDayOfWeek);
  const gridEnd = new Date(y, m - 1, totalCells - firstDayOfWeek + 1);
  return {
    firstDayOfWeek,
    daysInMonth,
    totalCells,
    startDate: gridStart.toISOString().split('T')[0],
    endDate: gridEnd.toISOString().split('T')[0],
  };
}

function buildWeekdayCells(y: number, m: number) {
  // 找到包含當月1日的那週的星期一
  const firstOfMonth = new Date(y, m - 1, 1);
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7; // Mon=0, Tue=1, ..., Sun=6
  const gridStart = new Date(y, m - 1, 1 - mondayOffset);

  // 找到包含當月最後一天的那週的星期五
  const lastOfMonth = new Date(y, m, 0);
  const mondayBasedLastDow = (lastOfMonth.getDay() + 6) % 7;
  const gridEnd = new Date(lastOfMonth);
  gridEnd.setDate(gridEnd.getDate() + (4 - mondayBasedLastDow) + 1); // +1 for exclusive

  type Cell = { dateStr: string | null; dayNum: number | null; isCurrentMonth: boolean };
  const cells: Cell[] = [];

  for (let d = new Date(gridStart); d < gridEnd; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue; // 跳過週六、週日
    const isCurrentMonth = d.getMonth() === m - 1 && d.getFullYear() === y;
    const dayNum = isCurrentMonth ? d.getDate() : null;
    const dateStr = isCurrentMonth
      ? `${y}-${String(m).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
      : null;
    cells.push({ dateStr, dayNum, isCurrentMonth });
  }

  return cells;
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

  const cells = buildWeekdayCells(y, m);

  // 依當月最多學生數決定字體大小與欄數
  const maxPerDay = Object.values(leavesByDate).reduce((max, arr) => Math.max(max, arr.length), 0);
  const dense = maxPerDay > 10; // 人多時啟用緊湊模式（字縮小、三欄、每人單行）
  const printNameSize =
    maxPerDay <= 3 ? 'print:text-base' :
    maxPerDay <= 6 ? 'print:text-sm' :
    maxPerDay <= 12 ? 'print:text-xs' :
    dense ? 'print:text-[8px]' :
    'print:text-[10px]';
  const printSubSize = maxPerDay <= 6 ? 'print:text-xs' : 'print:text-[10px]';
  const printGridCols =
    maxPerDay <= 4 ? 'print:grid-cols-1' :
    dense ? 'print:grid-cols-3' :
    '';

  return (
    <div className="overflow-x-auto print:overflow-visible">
      <div className="border rounded-lg overflow-hidden min-w-[400px]">
        {/* 星期標頭（一～五） */}
        <div className="grid grid-cols-5 border-b bg-muted/40">
          {WEEKDAYS.map((wd) => (
            <div key={wd} className="py-2 print:py-1 text-center text-xs font-medium text-muted-foreground">
              {wd}
            </div>
          ))}
        </div>

        {/* 日期格子 */}
        <div className="grid grid-cols-5">
          {cells.map((cell, i) => {
            const dayLeaves = cell.dateStr ? (leavesByDate[cell.dateStr] ?? []) : [];
            const isToday = cell.dateStr === todayStr;

            return (
              <div
                key={i}
                className={`h-32 sm:h-40 print:h-auto p-1 sm:p-1.5 print:p-0.5 border-b border-r flex flex-col overflow-hidden print:overflow-visible ${
                  !cell.isCurrentMonth ? 'bg-muted/20' : ''
                } ${isToday ? 'bg-blue-50/60' : ''}`}
              >
                {cell.isCurrentMonth && (
                  <>
                    <div
                      className={`text-xs font-medium mb-0.5 w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-full shrink-0 ${
                        isToday ? 'bg-primary text-primary-foreground' : 'text-foreground'
                      }`}
                    >
                      {cell.dayNum}
                    </div>
                    <div className={`grid grid-cols-1 sm:grid-cols-2 ${printGridCols} gap-x-1 gap-y-0 sm:gap-y-0.5 overflow-y-auto print:overflow-visible flex-1 min-h-0 pr-0.5`}>
                      {dayLeaves.map((l) => (
                        <div key={l.id} className="leading-tight min-w-0">
                          <div className="flex items-center gap-0.5 min-w-0">
                            <span className={`text-[10px] sm:text-xs ${printNameSize} truncate ${dense ? '' : 'print:whitespace-normal'}`}>
                              {l.students?.name}
                              {/* 密集列印模式：英文名+年級合併到同一行 */}
                              {dense && (
                                <span className="hidden print:inline text-muted-foreground">
                                  {' '}{[
                                    l.students?.english_name,
                                    l.students?.enrollment_date ? getGradeShort(l.students.enrollment_date) : null,
                                  ].filter(Boolean).join(' ')}
                                </span>
                              )}
                            </span>
                            {l.leave_type && (
                              <span
                                className={`hidden sm:inline print:inline text-[10px] ${printSubSize} px-1 py-0 rounded border leading-4 shrink-0 ${
                                  LEAVE_TYPE_COLOR[l.leave_type] ?? ''
                                }`}
                              >
                                {l.leave_type}
                              </span>
                            )}
                          </div>
                          {/* 非密集模式才顯示第二行；密集模式資訊已合入第一行 */}
                          <div className={`text-[10px] ${printSubSize} text-muted-foreground truncate print:whitespace-normal ${dense ? 'print:hidden' : ''}`}>
                            {[
                              l.students?.english_name,
                              l.students?.enrollment_date ? getGradeShort(l.students.enrollment_date) : null,
                            ].filter(Boolean).join(' ')}
                          </div>
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
