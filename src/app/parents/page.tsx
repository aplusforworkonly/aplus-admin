import { createServerClient } from '@/lib/supabase/server';
import ParentTable from '@/components/parents/ParentTable';

export default async function ParentsPage() {
  const supabase = createServerClient();

  const { data: parents, error } = await supabase
    .from('parents')
    .select(`
      *,
      parent_student_mapping (
        relationship,
        students ( id, name, english_name, status )
      )
    `)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">家長管理</h1>
      </div>
      <ParentTable parents={(parents ?? []) as any} />
    </div>
  );
}
