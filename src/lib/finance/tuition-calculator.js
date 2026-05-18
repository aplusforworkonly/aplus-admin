// ── 2026 暑假曆 ────────────────────────────────────────────────────────────
const CALENDAR = {
  july: {
    schoolDays: 18,
    nonRefundableDates: new Set(['2026-07-03']), // 週五托育日，請假不退費
    activityDates: new Set(['2026-07-10','2026-07-17','2026-07-23','2026-07-24','2026-07-31']),
  },
  august: {
    schoolDays: 16,
    nonRefundableDates: new Set(),
    activityDates: new Set(['2026-08-07','2026-08-14','2026-08-21','2026-08-28','2026-08-31']),
  },
};

// ── 各營隊總堂數 ───────────────────────────────────────────────────────────
const CAMP_DAYS = {
  '化石生態營': 8,
  '美學手作營': 8,
  '自然電路營': 8,
  '玩具製作營': 7,
};

// ── 戶外教學全報優惠（同月全報 → -300）────────────────────────────────────
const JULY_TRIPS  = ['7/10｜戶外教學', '7/17｜戶外教學', '7/31｜戶外教學'];
const AUGUST_TRIPS = ['8/7｜戶外教學', '8/14｜戶外教學', '8/21｜戶外教學'];

// ── 百元微調 ───────────────────────────────────────────────────────────────
function roundToHundred(amount) {
  const remainder = Math.round(amount) % 100;
  if (remainder === 0) return amount;
  const base = Math.floor(amount / 100) * 100;
  if (remainder <= 15) return base;
  if (remainder <= 54) return base + 50;
  return base + 100;
}

// ── 折扣計算 ───────────────────────────────────────────────────────────────
function calcDiscounts(enrollments, isSchoolStudent) {
  const items = [];
  const names = enrollments.map(e => e.courseName);
  const getPrice = name => enrollments.find(e => e.courseName === name)?.basePrice ?? 0;

  // 1. 校內生優惠
  if (isSchoolStudent) {
    if (names.includes('7月夏令營全日基本課程'))
      items.push({ name: '校內生優惠-7月', amount: -3000 });
    if (names.includes('8月夏令營全日基本課程'))
      items.push({ name: '校內生優惠-8月', amount: -3000 });
  }

  // 2. 7月營隊組合優惠：校內生 + 7月全日課程 + 化石生態營 + 玩具製作營 → 兩營總價 6400
  if (isSchoolStudent &&
      names.includes('7月夏令營全日基本課程') &&
      names.includes('化石生態營') &&
      names.includes('玩具製作營')) {
    const discount = getPrice('化石生態營') + getPrice('玩具製作營') - 6400;
    if (discount > 0) items.push({ name: '7月營隊組合優惠', amount: -discount });
  }

  // 3. 8月營隊組合優惠：校內生 + 8月全日課程 + 美學手作營 + 自然電路營 → 兩營總價 7000
  if (isSchoolStudent &&
      names.includes('8月夏令營全日基本課程') &&
      names.includes('美學手作營') &&
      names.includes('自然電路營')) {
    const discount = getPrice('美學手作營') + getPrice('自然電路營') - 7000;
    if (discount > 0) items.push({ name: '8月營隊組合優惠', amount: -discount });
  }

  // 4. 戶外教學全報優惠：同月全報 → -300（課程名含年級後綴，用 startsWith 比對）
  if (JULY_TRIPS.every(c => names.some(n => n.startsWith(c))))
    items.push({ name: '7月戶外教學全報優惠', amount: -300 });
  if (AUGUST_TRIPS.every(c => names.some(n => n.startsWith(c))))
    items.push({ name: '8月戶外教學全報優惠', amount: -300 });

  // 5. 真人口說特惠：有全日課程 + 至少 1 個營隊 → 折抵 800
  if (names.includes('真人口說密集特訓')) {
    const hasFullDay = names.some(n => n.includes('全日基本課程'));
    const hasCamp = names.some(n => Object.keys(CAMP_DAYS).includes(n));
    if (hasFullDay && hasCamp)
      items.push({ name: '真人口說特惠', amount: -800 });
  }

  // 6. 兩天一夜校內生優惠 → -500
  if (isSchoolStudent && names.some(n => n.startsWith('7/23、24｜兩天一夜')))
    items.push({ name: '兩天一夜校內生優惠', amount: -500 });

  return items;
}

// ── 基本課程退費 ───────────────────────────────────────────────────────────
function calcBasicLeaveRefund(courseName, actualFee, leaveDates) {
  const isJuly = courseName.includes('7月');
  const cal = isJuly ? CALENDAR.july : CALENDAR.august;

  const refundableDays = leaveDates.filter(
    d => !cal.nonRefundableDates.has(d) && !cal.activityDates.has(d)
  ).length;

  if (refundableDays === 0) return null;

  const raw = actualFee / cal.schoolDays * 0.9 * refundableDays;
  return { name: `${courseName} 請假退費`, amount: -roundToHundred(raw) };
}

// ── 營隊退費 ───────────────────────────────────────────────────────────────
function calcCampLeaveRefund(courseName, actualFee, attendedDays) {
  const totalDays = CAMP_DAYS[courseName];
  if (totalDays == null || attendedDays >= totalDays) return null;

  const charge = Math.round(actualFee / totalDays * attendedDays);
  const refund = actualFee - charge;
  return refund > 0 ? { name: `${courseName} 退費`, amount: -refund } : null;
}

// ── 半日計算 ───────────────────────────────────────────────────────────────
function calcHalfMonthFee(fullFee) {
  return roundToHundred(fullFee * 0.6);
}

// 整月半日含餐：學費先打折微調，餐費再加（餐費不參與百元微調）
function calcHalfMonthFeeWithMeal(fullFee, mealDays) {
  return roundToHundred(fullFee * 0.6) + 55 * mealDays;
}

// 單日半假退費（負數）。若含餐，抵回當日餐費
function calcSingleHalfDayDeduction(courseName, fullFee, halfDayCount, mealDays = 0) {
  const isJuly = courseName.includes('7月');
  const schoolDays = isJuly ? CALENDAR.july.schoolDays : CALENDAR.august.schoolDays;
  const raw = fullFee / schoolDays * 0.9 * 0.4 * halfDayCount;
  const deduction = roundToHundred(raw);
  const mealAdd = 55 * mealDays;
  return { name: `${courseName} 半日扣款`, amount: -deduction + mealAdd };
}

// ── 8月底特殊進班費 ────────────────────────────────────────────────────────
function calcAugustSpecialFees(enrollments, attendance) {
  const items = [];
  const hasAugFull = enrollments.some(e => e.courseName === '8月夏令營全日基本課程');

  if (attendance?.['2026-08-28'] && !hasAugFull)
    items.push({ name: '8/28 返校日進班費', amount: 470 });

  if (attendance?.['2026-08-31'])
    items.push({ name: '8/31 開學日進班費', amount: 470 });

  return items;
}

// ── 單上英語重疊退費 ───────────────────────────────────────────────────────
function calcEnglishOverlapRefund(enrollments) {
  const names = enrollments.map(e => e.courseName);
  const hasSummerFull = names.some(n => n.includes('全日基本課程'));
  const hasEnglishOnly = names.includes('單上英語');
  if (hasSummerFull && hasEnglishOnly)
    return { name: '單上英語上課區間涵蓋夏令營，期間重疊之課程費用調整', amount: -4000 };
  return null;
}

// ── 主計算器 ───────────────────────────────────────────────────────────────
/**
 * @typedef {{
 *   courseName: string,
 *   courseType: 'main_course' | 'camp' | 'trip' | 'material',
 *   basePrice: number,
 *   actualFee: number,
 *   attendedDays?: number
 * }} EnrollmentInput
 *
 * @typedef {{
 *   julyFullHalf?: boolean,
 *   julyFullHalfMeal?: boolean,
 *   augustFullHalf?: boolean,
 *   augustFullHalfMeal?: boolean,
 *   halfDayDates?: string[],
 *   halfDayMealDates?: string[],
 * }} HalfDayConfig
 */
export class TuitionCalculator {
  /**
   * @param {object} params
   * @param {EnrollmentInput[]} params.enrollments
   * @param {string[]}          [params.leaveDates]     - 'YYYY-MM-DD'
   * @param {HalfDayConfig}     [params.halfDayConfig]
   * @param {Record<string,boolean>} [params.attendance] - 特殊日期出席
   * @param {boolean}           [params.isSchoolStudent]
   */
  constructor({ enrollments, leaveDates = [], halfDayConfig = {}, attendance = {}, isSchoolStudent = false, chargedMaterialFees = [] }) {
    this.enrollments = enrollments;
    this.leaveDates = leaveDates;
    this.halfDayConfig = halfDayConfig;
    this.attendance = attendance;
    this.isSchoolStudent = isSchoolStudent;
    this.chargedMaterialFees = chargedMaterialFees;
  }

  calculate() {
    const items = [];
    const hd = this.halfDayConfig;

    // 1. 原價（整月半日直接替換金額）
    for (const e of this.enrollments) {
      if (e.courseType === 'main_course') {
        const isJuly = e.courseName.includes('7月');
        const cal = isJuly ? CALENDAR.july : CALENDAR.august;
        const fullHalf     = isJuly ? hd.julyFullHalf     : hd.augustFullHalf;
        const fullHalfMeal = isJuly ? hd.julyFullHalfMeal : hd.augustFullHalfMeal;
        if (fullHalfMeal) {
          items.push({ name: e.courseName, amount: calcHalfMonthFeeWithMeal(e.basePrice, cal.schoolDays) });
        } else if (fullHalf) {
          items.push({ name: e.courseName, amount: calcHalfMonthFee(e.basePrice) });
        } else {
          items.push({ name: e.courseName, amount: e.basePrice });
        }
      } else {
        items.push({ name: e.courseName, amount: e.basePrice });
      }
    }

    // 2. 折扣
    items.push(...calcDiscounts(this.enrollments, this.isSchoolStudent));

    // 3. 基本課程請假退費（整月半日不適用）
    for (const e of this.enrollments.filter(e => e.courseType === 'main_course')) {
      const isJuly = e.courseName.includes('7月');
      const isFullHalf = isJuly
        ? (hd.julyFullHalf || hd.julyFullHalfMeal)
        : (hd.augustFullHalf || hd.augustFullHalfMeal);
      if (isFullHalf) continue;
      const refund = calcBasicLeaveRefund(e.courseName, e.actualFee, this.leaveDates);
      if (refund) items.push(refund);
    }

    // 4. 單日半假扣款（整月半日不適用）
    for (const e of this.enrollments.filter(e => e.courseType === 'main_course')) {
      const isJuly = e.courseName.includes('7月');
      const isFullHalf = isJuly
        ? (hd.julyFullHalf || hd.julyFullHalfMeal)
        : (hd.augustFullHalf || hd.augustFullHalfMeal);
      if (isFullHalf) continue;
      const prefix = isJuly ? '2026-07' : '2026-08';
      const relevantHalfDays = (hd.halfDayDates ?? []).filter(d => d.startsWith(prefix));
      if (relevantHalfDays.length === 0) continue;
      const relevantMealDays = (hd.halfDayMealDates ?? []).filter(d => relevantHalfDays.includes(d));
      const item = calcSingleHalfDayDeduction(e.courseName, e.actualFee, relevantHalfDays.length, relevantMealDays.length);
      if (item.amount !== 0) items.push(item);
    }

    // 5. 營隊請假退費
    for (const e of this.enrollments.filter(e => e.courseType === 'camp' && e.attendedDays != null)) {
      const refund = calcCampLeaveRefund(e.courseName, e.actualFee, e.attendedDays);
      if (refund) items.push(refund);
    }

    // 6. 單上英語重疊退費
    const overlap = calcEnglishOverlapRefund(this.enrollments);
    if (overlap) items.push(overlap);

    // 7. 8月底特殊進班費
    items.push(...calcAugustSpecialFees(this.enrollments, this.attendance));

    // 8. YLE 教材費（報名 YLE英檢實力班 → 自動加收 2000，跨月只收一次）
    if (this.enrollments.some(e => e.courseName === 'YLE英檢實力班') && !this.chargedMaterialFees.includes('YLE教材費'))
      items.push({ name: 'YLE教材費', amount: 2000 });

    return items.filter(i => i.amount !== 0);
  }
}

export {
  roundToHundred,
  calcDiscounts,
  calcBasicLeaveRefund,
  calcCampLeaveRefund,
  calcHalfMonthFee,
  calcHalfMonthFeeWithMeal,
  calcSingleHalfDayDeduction,
  calcAugustSpecialFees,
  calcEnglishOverlapRefund,
  CALENDAR,
  CAMP_DAYS,
};
