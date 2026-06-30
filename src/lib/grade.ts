const GRADE_LABELS: Record<number, string> = {
  0: '大班升小一',
  1: '小一',
  2: '小二',
  3: '小三',
  4: '小四',
  5: '小五',
  6: '小六',
};

function currentTWYear(): number {
  const now = new Date();
  // Academic year starts September 1; before that we're still in the previous TW year
  return now.getFullYear() - 1911 - (now.getMonth() < 6 ? 1 : 0);
}

export function getGrade(enrollmentDate: string): string {
  const d = new Date(enrollmentDate);
  const enrollTWYear = d.getFullYear() - 1911 - (d.getMonth() < 6 ? 1 : 0);
  const grade = currentTWYear() - enrollTWYear + 1;
  return GRADE_LABELS[grade] ?? (grade > 6 ? '已畢業' : '大班升小一');
}

const GRADE_SHORT: Record<number, string> = {
  0: '（幼）',
  1: '（一）',
  2: '（二）',
  3: '（三）',
  4: '（四）',
  5: '（五）',
  6: '（六）',
};

export function getGradeShort(enrollmentDate: string): string {
  const d = new Date(enrollmentDate);
  const enrollTWYear = d.getFullYear() - 1911 - (d.getMonth() < 6 ? 1 : 0);
  const grade = currentTWYear() - enrollTWYear + 1;
  return GRADE_SHORT[grade] ?? '';
}

// 回傳年級數字（0=大班升小一, 1-6=小一到小六），供路由規則比對使用
export function getGradeNumber(enrollmentDate: string): number {
  const d = new Date(enrollmentDate);
  const enrollTWYear = d.getFullYear() - 1911 - (d.getMonth() < 6 ? 1 : 0);
  return currentTWYear() - enrollTWYear + 1;
}
