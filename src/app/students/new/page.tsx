import { createServerClient } from '@/lib/supabase/server';
import StudentForm from '@/components/students/StudentForm';
import Link from 'next/link';

export default async function NewStudentPage() {
  const supabase = createServerClient();
  const { data: teachers } = await supabase
    .from('teachers')
    .select('id, name, english_name, department')
    .neq('status', '離職')
    .order('name');

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <Link href="/students" className="text-sm text-muted-foreground hover:text-foreground">
          ← 學生管理
        </Link>
        <h1 className="text-2xl font-bold mt-1">新增學生</h1>
      </div>
      <StudentForm teachers={(teachers ?? []) as any} />
    </div>
  );
}
