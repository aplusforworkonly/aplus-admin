import { createServerClient } from '@/lib/supabase/server';
import { approveStudentReview, rejectStudentReview } from '@/actions/student-reviews';
import { Button } from '@/components/ui/button';

const FIELD_LABELS: Record<string, string> = {
  english_name: '英文名',
  campus: '校區',
  id_number: '身份證字號',
};

export default async function StudentReviewsPage() {
  const supabase = createServerClient();

  const { data: reviews } = await supabase
    .from('student_review_requests')
    .select('id, proposed_changes, created_at, students(id, name)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  const pending = reviews ?? [];

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">學生資料審核</h1>
      <p className="text-sm text-muted-foreground">
        以下學生在重新填寫報名表時，資料與原有記錄不符，請確認後核准或拒絕變更。
      </p>

      {pending.length === 0 ? (
        <div className="bg-background rounded-xl border shadow-sm p-8 text-center text-sm text-muted-foreground">
          目前沒有待審核的資料變更。
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2 font-medium">學生</th>
                <th className="text-left px-4 py-2 font-medium">欄位</th>
                <th className="text-left px-4 py-2 font-medium">現有資料</th>
                <th className="text-left px-4 py-2 font-medium">新填資料</th>
                <th className="text-left px-4 py-2 font-medium">申請時間</th>
                <th className="w-36"></th>
              </tr>
            </thead>
            <tbody>
              {pending.map((r) => {
                const student = r.students as unknown as { id: string; name: string } | null;
                const changes = r.proposed_changes as Record<string, { old: unknown; new: unknown }>;
                const fields = Object.entries(changes);
                return fields.map(([field, diff], idx) => (
                  <tr key={`${r.id}-${field}`} className="border-t hover:bg-muted/30">
                    {idx === 0 && (
                      <td className="px-4 py-2 font-medium" rowSpan={fields.length}>
                        {student?.name ?? '—'}
                      </td>
                    )}
                    <td className="px-4 py-2 text-muted-foreground">
                      {FIELD_LABELS[field] ?? field}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {String(diff.old ?? '（空白）')}
                    </td>
                    <td className="px-4 py-2 font-medium">
                      {String(diff.new ?? '（空白）')}
                    </td>
                    {idx === 0 && (
                      <td className="px-4 py-2 text-muted-foreground text-xs" rowSpan={fields.length}>
                        {new Date(r.created_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}
                      </td>
                    )}
                    {idx === 0 && (
                      <td className="px-4 py-2" rowSpan={fields.length}>
                        <div className="flex gap-2">
                          <form action={approveStudentReview.bind(null, r.id)}>
                            <Button size="sm" variant="default" type="submit">核准</Button>
                          </form>
                          <form action={rejectStudentReview.bind(null, r.id)}>
                            <Button size="sm" variant="outline" type="submit">拒絕</Button>
                          </form>
                        </div>
                      </td>
                    )}
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
