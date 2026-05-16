import { createServerClient } from '@/lib/supabase/server';
import { approveStudentReview, rejectStudentReview } from '@/actions/student-reviews';
import { Button } from '@/components/ui/button';
import DuplicateStudentAlert, { type DuplicateGroup } from '@/components/admin/DuplicateStudentAlert';

const FIELD_LABELS: Record<string, string> = {
  english_name: '英文名',
  campus: '校區',
  id_number: '身份證字號',
};

export default async function StudentReviewsPage() {
  const supabase = createServerClient();

  const [{ data: reviews }, { data: resolvedReviews }, { data: allStudents }] = await Promise.all([
    supabase
      .from('student_review_requests')
      .select('id, proposed_changes, created_at, students(id, name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true }),
    supabase
      .from('student_review_requests')
      .select('id, status, proposed_changes, resolved_at, students(name)')
      .in('status', ['approved', 'rejected'])
      .order('resolved_at', { ascending: false })
      .limit(30),
    supabase
      .from('students')
      .select('id, name, english_name, campus, id_number, status')
      .eq('status', '就讀中'),
  ]);

  const pending = reviews ?? [];
  const resolved = resolvedReviews ?? [];

  // Fetch audit logs for resolved reviews
  const resolvedIds = resolved.map((r) => r.id);
  let auditByRequestId: Record<string, { to_status: string; created_at: string; teachers: { name: string } | null }> = {};
  if (resolvedIds.length > 0) {
    const { data: auditLogs } = await supabase
      .from('request_audit_log')
      .select('request_id, to_status, created_at, teachers(name)')
      .in('request_id', resolvedIds)
      .order('created_at', { ascending: false });
    for (const log of auditLogs ?? []) {
      if (!auditByRequestId[log.request_id]) {
        auditByRequestId[log.request_id] = log as any;
      }
    }
  }

  // 找出同名同英文名的重複學生群組
  type RawStudent = { id: string; name: string; english_name: string | null; campus: string | null; id_number: string | null };
  const students = (allStudents ?? []) as RawStudent[];

  const groups = new Map<string, RawStudent[]>();
  for (const s of students) {
    if (!s.english_name) continue;
    const key = `${s.name}||${s.english_name}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }
  const rawDuplicates = [...groups.values()].filter((g) => g.length > 1);

  // 額外查詢重複學生的家長與課程資料
  const dupIds = rawDuplicates.flat().map((s) => s.id);

  const [{ data: mappings }, { data: dupEnrollments }] = dupIds.length > 0
    ? await Promise.all([
        supabase
          .from('parent_student_mapping')
          .select('id, student_id, parent_id, parents(name, phone)')
          .in('student_id', dupIds),
        supabase
          .from('enrollments')
          .select('student_id, courses(name)')
          .in('student_id', dupIds)
          .eq('status', '生效'),
      ])
    : [{ data: [] }, { data: [] }];

  // 整理成 map
  const parentMap: Record<string, { mappingId: string; parentId: string; name: string; phone: string }[]> = {};
  for (const m of mappings ?? []) {
    const sid = (m as any).student_id;
    const p = (m as any).parents;
    if (!p) continue;
    if (!parentMap[sid]) parentMap[sid] = [];
    parentMap[sid].push({ mappingId: (m as any).id, parentId: (m as any).parent_id, name: p.name, phone: p.phone });
  }

  const courseMap: Record<string, string[]> = {};
  for (const e of dupEnrollments ?? []) {
    const sid = (e as any).student_id;
    const c = (e as any).courses;
    if (!c) continue;
    if (!courseMap[sid]) courseMap[sid] = [];
    courseMap[sid].push(c.name);
  }

  const duplicateGroups: DuplicateGroup[] = rawDuplicates.map((group) =>
    group.map((s) => ({
      id: s.id,
      name: s.name,
      english_name: s.english_name,
      campus: s.campus,
      id_number: s.id_number,
      parents: parentMap[s.id] ?? [],
      courses: courseMap[s.id] ?? [],
    }))
  );

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">學生資料審核</h1>

      {/* 重複學生警示 */}
      {duplicateGroups.length > 0 && (
        <DuplicateStudentAlert groups={duplicateGroups} />
      )}

      {/* 待審核資料變更 */}
      <div className="space-y-3">
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

      {/* 已處理歷史紀錄 */}
      {resolved.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">已處理紀錄</h2>
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">學生</th>
                  <th className="text-left px-4 py-2 font-medium">欄位</th>
                  <th className="text-left px-4 py-2 font-medium">舊資料</th>
                  <th className="text-left px-4 py-2 font-medium">新資料</th>
                  <th className="text-left px-4 py-2 font-medium">結果</th>
                  <th className="text-left px-4 py-2 font-medium">審核人</th>
                  <th className="text-left px-4 py-2 font-medium">審核時間</th>
                </tr>
              </thead>
              <tbody>
                {resolved.map((r) => {
                  const student = r.students as unknown as { name: string } | null;
                  const changes = r.proposed_changes as Record<string, { old: unknown; new: unknown }>;
                  const fields = Object.entries(changes);
                  const audit = auditByRequestId[r.id];
                  const isApproved = r.status === 'approved';
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
                      <td className="px-4 py-2 text-muted-foreground">{String(diff.old ?? '（空白）')}</td>
                      <td className="px-4 py-2">{String(diff.new ?? '（空白）')}</td>
                      {idx === 0 && (
                        <td className="px-4 py-2" rowSpan={fields.length}>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${isApproved ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {isApproved ? '核准' : '拒絕'}
                          </span>
                        </td>
                      )}
                      {idx === 0 && (
                        <td className="px-4 py-2 text-muted-foreground text-xs" rowSpan={fields.length}>
                          {(audit?.teachers as any)?.name ?? '—'}
                        </td>
                      )}
                      {idx === 0 && (
                        <td className="px-4 py-2 text-muted-foreground text-xs" rowSpan={fields.length}>
                          {r.resolved_at
                            ? new Date(r.resolved_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
                            : '—'}
                        </td>
                      )}
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
