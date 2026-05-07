import { createServerClient } from '@/lib/supabase/server';
import StudentTable from '@/components/students/StudentTable';
import type { StudentWithParents } from '@/lib/supabase/types';

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;
  const supabase = createServerClient();

  // Fetch students only (no parent JOIN) to avoid Supabase statement_timeout on free plan
  let query = supabase
    .from('students')
    .select('*')
    .order('created_at', { ascending: false });

  if (q) {
    query = query.or(`name.ilike.%${q}%,id_number.ilike.%${q}%`);
  }
  if (status) {
    query = query.eq('status', status);
  }

  const { data: students, error } = await query;
  if (error) throw new Error(error.message);

  // Cast to StudentWithParents with empty mapping array for the list page
  const studentsWithEmptyMapping = (students ?? []).map((s) => ({
    ...s,
    parent_student_mapping: [],
  }));

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">學生管理</h1>
      </div>
      <StudentTable initialStudents={studentsWithEmptyMapping as StudentWithParents[]} />
    </div>
  );
}
