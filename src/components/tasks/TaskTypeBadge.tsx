import { Badge } from '@/components/ui/badge';
import type { TaskType } from '@/lib/supabase/types';

const config: Record<TaskType, { label: string; className: string }> = {
  project: { label: '專案', className: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  routine: { label: '例行', className: 'bg-teal-100 text-teal-700 border-teal-200' },
  adhoc:   { label: '突發', className: 'bg-orange-100 text-orange-700 border-orange-200' },
};

export function TaskTypeBadge({ type }: { type: TaskType }) {
  const { label, className } = config[type] ?? config.adhoc;
  return <Badge variant="outline" className={className}>{label}</Badge>;
}
