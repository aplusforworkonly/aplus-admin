import { createServerClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import AddTeacherForm from '@/components/teachers/AddTeacherForm';
import ImportTeachersButton from '@/components/teachers/ImportTeachersButton';

export default async function TeachersPage() {
  const supabase = createServerClient();
  const { data: teachers } = await supabase
    .from('teachers')
    .select('id, name, english_name, email, campus, department, status, user_id')
    .neq('status', '離職')
    .order('created_at');

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">老師管理</h1>

      <div className="flex flex-col gap-4">
        <AddTeacherForm />
        <ImportTeachersButton />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>姓名</TableHead>
            <TableHead>部門</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>校區</TableHead>
            <TableHead className="w-24 text-center">帳號狀態</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(teachers ?? []).length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                尚無老師資料
              </TableCell>
            </TableRow>
          )}
          {(teachers ?? []).map((t) => (
            <TableRow key={t.id}>
              <TableCell className="font-medium">
                {t.name}
                {t.english_name && (
                  <span className="text-xs text-muted-foreground ml-1">{t.english_name}</span>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{t.department ?? '—'}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{t.email}</TableCell>
              <TableCell className="text-sm">{t.campus ?? '—'}</TableCell>
              <TableCell className="text-center">
                {t.user_id
                  ? <Badge variant="default">已連結</Badge>
                  : <Badge variant="outline">待登入</Badge>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
