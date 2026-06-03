import { Badge } from '@/components/ui/badge';
import type { TaskStatus } from '@/lib/supabase/types';

const config: Record<TaskStatus, { label: string; className: string }> = {
  pending:     { label: '待處理',  className: 'bg-slate-100 text-slate-600 border-slate-200' },
  in_progress: { label: '進行中',  className: 'bg-blue-100 text-blue-700 border-blue-200' },
  completed:   { label: '已完成',  className: 'bg-green-100 text-green-700 border-green-200' },
  overdue:     { label: '已逾期',  className: 'bg-red-100 text-red-700 border-red-200' },
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const { label, className } = config[status] ?? config.pending;
  return <Badge variant="outline" className={className}>{label}</Badge>;
}
