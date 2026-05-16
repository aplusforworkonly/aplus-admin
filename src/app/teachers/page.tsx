import { createServerClient } from '@/lib/supabase/server';
import AddTeacherForm from '@/components/teachers/AddTeacherForm';
import ImportTeachersButton from '@/components/teachers/ImportTeachersButton';
import TeachersTable from '@/components/teachers/TeachersTable';

export default async function TeachersPage() {
  const supabase = createServerClient();
  const { data: teachers } = await supabase
    .from('teachers')
    .select('id, name, english_name, email, campus, department, status, user_id, is_supervisor')
    .neq('status', '離職')
    .order('name');

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">老師管理</h1>

      <div className="flex flex-col gap-4">
        <AddTeacherForm />
        <ImportTeachersButton />
      </div>

      <TeachersTable
        teachers={(teachers ?? []) as any}
        allActiveTeachers={(teachers ?? []).filter((t: any) => t.status === '在職') as any}
      />
    </div>
  );
}
