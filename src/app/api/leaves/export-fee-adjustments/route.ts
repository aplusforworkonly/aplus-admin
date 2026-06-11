import { createServerClient } from '@/lib/supabase/server';
import { getGrade } from '@/lib/grade';
import { CAMPUSES } from '@/lib/constants';
import ExcelJS from 'exceljs';

// ── 複製自 tuition-calculator.js ────────────────────────────────────────────
function roundToHundred(amount: number): number {
  const remainder = Math.round(amount) % 100;
  if (remainder === 0) return amount;
  const base = Math.floor(amount / 100) * 100;
  if (remainder <= 15) return base;
  if (remainder <= 54) return base + 50;
  return base + 100;
}

const ACTIVITY_DATES: Record<string, Set<string>> = {
  '07': new Set(['2026-07-10', '2026-07-17', '2026-07-23', '2026-07-24', '2026-07-31']),
  '08': new Set(['2026-08-07', '2026-08-14', '2026-08-21', '2026-08-28']),
};
const SCHOOL_DAYS: Record<string, number> = { '07': 18, '08': 16 };
// ────────────────────────────────────────────────────────────────────────────

const CUTOFF = new Date('2026-06-04T00:00:00+08:00');
const CAMPUS_ORDER: string[] = [...CAMPUSES];
const GRADE_ORDER = ['大班升小一', '小一', '小二', '小三', '小四', '小五', '小六', '已畢業'];
const STATUS_MAP: Record<string, string> = {
  pending: '待確認', approved: '已核准', rejected: '已拒絕', cancelled: '已取消',
};

function toTaipei(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) : '';
}

// 展開 leave_date ~ leave_date_end 範圍，跳過週末，不用 toISOString()
function expandDates(start: string, end: string | null): string[] {
  const dates: string[] = [];
  const cur = new Date(start + 'T00:00:00+08:00');
  const last = new Date((end ?? start) + 'T00:00:00+08:00');
  while (cur <= last) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${d}`);
    }
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

type FillColor = { type: 'pattern'; pattern: 'solid'; fgColor: { argb: string } };
const fill = (argb: string): FillColor => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

export async function GET() {
  const supabase = createServerClient();

  // Stage 1：leave_requests + enrollments 並行
  const [leaveRes, enrollRes] = await Promise.all([
    supabase
      .from('leave_requests')
      .select('id, leave_date, leave_date_end, leave_type, reason, status, created_at, student_id, students(name, english_name, campus, enrollment_date, main_tutor_id, is_school_student)')
      .eq('request_type', '請假')
      .gte('leave_date', '2026-07-01')
      .lt('leave_date', '2026-09-01')
      .order('leave_date'),
    supabase
      .from('enrollments')
      .select('student_id, start_date, courses!inner(name, course_type, base_price)')
      .eq('status', '生效')
      .eq('courses.course_type', 'main_course')
      .gte('start_date', '2026-07-01')
      .lt('start_date', '2026-09-01'),
  ]);

  const leaves = leaveRes.data ?? [];

  // Stage 2：取導師名字
  const tutorIds = [...new Set(
    leaves.map((r: any) => (r.students as any)?.main_tutor_id).filter(Boolean)
  )];
  const { data: tutorRows } = tutorIds.length > 0
    ? await supabase.from('teachers').select('id, name').in('id', tutorIds)
    : { data: [] };
  const tutorMap = new Map<string, string>((tutorRows ?? []).map((t: any) => [t.id, t.name as string]));

  // feeMap: `${studentId}-${月份}` → basePrice（複合 Key 防止 7、8 月覆蓋）
  const feeMap = new Map<string, number>();
  for (const e of enrollRes.data ?? []) {
    const month = (e.start_date as string).substring(5, 7);
    feeMap.set(`${e.student_id}-${month}`, (e.courses as any).base_price as number);
  }

  // 依學生 ID 分組
  const studentLeaves = new Map<string, { student: any; records: any[] }>();
  for (const r of leaves) {
    const sid = r.student_id as string;
    if (!studentLeaves.has(sid)) {
      studentLeaves.set(sid, { student: r.students, records: [] });
    }
    studentLeaves.get(sid)!.records.push(r);
  }

  // 排序：校區 → 年級 → 導師 → 姓名
  const sorted = [...studentLeaves.entries()].sort(([, a], [, b]) => {
    const sa = (a.student ?? {}) as any;
    const sb = (b.student ?? {}) as any;
    const ci = (c: string) => { const i = CAMPUS_ORDER.indexOf(c); return i === -1 ? 99 : i; };
    const gi = (d: string) => { const i = GRADE_ORDER.indexOf(getGrade(d ?? '')); return i === -1 ? 99 : i; };
    if (ci(sa.campus) !== ci(sb.campus)) return ci(sa.campus) - ci(sb.campus);
    if (gi(sa.enrollment_date) !== gi(sb.enrollment_date)) return gi(sa.enrollment_date) - gi(sb.enrollment_date);
    const ta = tutorMap.get(sa.main_tutor_id) ?? '';
    const tb = tutorMap.get(sb.main_tutor_id) ?? '';
    if (ta !== tb) return ta.localeCompare(tb, 'zh-TW');
    return (sa.name ?? '').localeCompare(sb.name ?? '', 'zh-TW');
  });

  // ── 組裝 Excel ───────────────────────────────────────────────────────────
  const workbook = new ExcelJS.Workbook();

  for (const campus of CAMPUS_ORDER) {
    const campusStudents = sorted.filter(([, { student }]) =>
      ((student ?? {}) as any).campus === campus
    );
    if (campusStudents.length === 0) continue;

    const ws = workbook.addWorksheet(campus);
    ws.columns = [
      { width: 10 },
      { width: 12 },
      { width: 24 },
      { width: 8  },
      { width: 22 },
      { width: 18 },
      { width: 8  },
      { width: 10 },
      { width: 52 },
    ];

    let lastGrade = '';
    let lastTutor = '';

    const isEligible = (r: any) => new Date(r.created_at) < CUTOFF;
    const isApproved = (r: any) => r.status === 'approved';
    const isRefundable = (r: any) => isEligible(r) && isApproved(r);

    for (const [studentId, { student, records }] of campusStudents) {
      const s = (student ?? {}) as any;
      const grade = getGrade(s.enrollment_date ?? '');
      const tutorName = s.main_tutor_id ? (tutorMap.get(s.main_tutor_id) ?? '未設定') : '未設定';
      const isSchool = !!s.is_school_student;

      // 年級標題行
      if (grade !== lastGrade) {
        const r = ws.addRow([`── ${grade}`, '', '', '', '', '', '', '', '']);
        ws.mergeCells(r.number, 1, r.number, 9);
        for (let i = 1; i <= 9; i++) {
          r.getCell(i).fill = fill('FFD9D9D9');
        }
        r.getCell(1).font = { bold: true };
        lastGrade = grade;
        lastTutor = '';      // 防止同名導師跨年級死鎖漏印標題
      }

      // 導師標題行 + 欄位標題行
      if (tutorName !== lastTutor) {
        const r = ws.addRow([`導師：${tutorName}`, '', '', '', '', '', '', '', '']);
        ws.mergeCells(r.number, 1, r.number, 9);
        for (let i = 1; i <= 9; i++) {
          r.getCell(i).fill = fill('FFEFEFEF');
        }
        const h = ws.addRow(['姓名', '英文名', '請假日期', '假別', '申請時間(台北)', '費用影響', '狀態', '退費試算', '計算公式']);
        h.eachCell((c) => {
          c.fill = fill('FF4472C4');
          c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        });
        lastTutor = tutorName;
      }

      // 資料行：會退費在前，其餘在後
      const refundableRecords = records.filter(isRefundable).sort((a: any, b: any) => a.leave_date.localeCompare(b.leave_date));
      const otherRecords = records.filter((r: any) => !isRefundable(r)).sort((a: any, b: any) => a.leave_date.localeCompare(b.leave_date));

      for (const r of [...refundableRecords, ...otherRecords]) {
        const eligible = isEligible(r);
        const approved = isApproved(r);
        const feeImpact = !eligible ? '不影響費用' : !approved ? '不影響費用(未核准)' : '會退費';
        const dateRange = r.leave_date_end && r.leave_date_end !== r.leave_date
          ? `${r.leave_date} ~ ${r.leave_date_end}`
          : r.leave_date;

        const row = ws.addRow([
          s.name ?? '', s.english_name ?? '',
          dateRange,
          r.leave_type ?? '',
          toTaipei(r.created_at),
          feeImpact,
          STATUS_MAP[r.status] ?? r.status,
          '', '',
        ]);

        if (isRefundable(r)) {
          row.eachCell((c) => { c.fill = fill('FFE2EFDA'); });
        }
      }

      // 退費小計（依月份拆分，用 Set 去重複日期）
      const monthDateSets = new Map<string, Set<string>>();
      for (const r of refundableRecords) {
        for (const d of expandDates(r.leave_date, r.leave_date_end)) {
          const mo = d.substring(5, 7);
          if (!monthDateSets.has(mo)) monthDateSets.set(mo, new Set());
          monthDateSets.get(mo)!.add(d);
        }
      }
      const monthDates = new Map<string, string[]>(
        [...monthDateSets.entries()].map(([mo, set]) => [mo, [...set]])
      );

      for (const [mo, allDates] of [...monthDates.entries()].sort()) {
        const actDates = ACTIVITY_DATES[mo] ?? new Set<string>();
        const refundableDays = allDates.filter((d) => !actDates.has(d)).length;
        const schoolDays = SCHOOL_DAYS[mo] ?? 18;
        const basePrice = feeMap.get(`${studentId}-${mo}`);

        if (!basePrice || refundableDays === 0) continue;

        const actualFee = basePrice - (isSchool ? 3000 : 0);
        const refundAmt = roundToHundred(actualFee / schoolDays * 0.9 * refundableDays);
        const moLabel = mo === '07' ? '7月' : '8月';
        const formula = `月費$${actualFee} ÷ ${schoolDays}天 × 90% × ${refundableDays}天(扣週末+托育日)`;

        const subtotal = ws.addRow([`▶ ${moLabel}退費小計`, '', '', '', '', '', '', `$${refundAmt}`, formula]);
        subtotal.eachCell((c) => {
          c.fill = fill('FFFFF2CC');
          c.font = { bold: true };
        });
      }

      // 學生間空行
      ws.addRow([]);
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="2026_Summer_Camp_Refund_List.xlsx"',
    },
  });
}
