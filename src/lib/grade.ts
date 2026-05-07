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
  return now.getFullYear() - 1911 - (now.getMonth() < 8 ? 1 : 0);
}

export function getGrade(enrollmentDate: string): string {
  const d = new Date(enrollmentDate);
  const enrollTWYear = d.getFullYear() - 1911 - (d.getMonth() < 8 ? 1 : 0);
  const grade = currentTWYear() - enrollTWYear + 1;
  return GRADE_LABELS[grade] ?? (grade > 6 ? '已畢業' : '大班升小一');
}
