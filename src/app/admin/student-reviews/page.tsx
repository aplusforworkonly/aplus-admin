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
      .select('id, review_type, proposed_changes, created_at, students(id, name)')
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
      .select('id, name, english_name, campus, id_number, status, parent_student_mapping(parent_id)')
      .eq('status', '就讀中'),
  ]);

  const pending = reviews ?? [];
  const resolved = resolvedReviews ?? [];

  const fieldChangePending = pending.filter((r: any) => r.review_type !== 'name_mismatch');
  const nameMismatchPending = pending.filter((r: any) => r.review_type === 'name_mismatch');

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

  // Step A：同名同英文名重複群組
  type RawStudent = { id: string; name: string; english_name: string | null; campus: string | null; id_number: string | null };
  const students = (allStudents ?? []) as RawStudent[];

  const nameGroupsMap = new Map<string, RawStudent[]>();
  for (const s of students) {
    if (!s.english_name) continue;
    const key = `${s.name}||${s.english_name}`;
    if (!nameGroupsMap.has(key)) nameGroupsMap.set(key, []);
    nameGroupsMap.get(key)!.push(s);
  }
  const rawNameDuplicates = [...nameGroupsMap.values()].filter((g) => g.length > 1);

  // Step B：同家長同英文名（不同中文名）群組，利用嵌入關聯取得 parent_id
  const studentById = new Map(students.map((s) => [s.id, s]));
  const parentEnGroupsMap = new Map<string, string[]>();
  for (const s of students) {
    if (!s.english_name) continue;
    for (const m of ((s as any).parent_student_mapping ?? [])) {
      const key = `${m.parent_id}||${s.english_name}`;
      if (!parentEnGroupsMap.has(key)) parentEnGroupsMap.set(key, []);
      parentEnGroupsMap.get(key)!.push(s.id);
    }
  }
  const sameParentDuplicates: RawStudent[][] = [...parentEnGroupsMap.values()]
    .filter((ids) => {
      if (ids.length < 2) return false;
      // 相異中文名數量 > 1 → 疑似填錯名字
      const nameSet = new Set(ids.map((id) => studentById.get(id)?.name ?? ''));
      return nameSet.size > 1;
    })
    .map((ids) => ids.map((id) => studentById.get(id)!).filter(Boolean) as RawStudent[]);

  // Step C：合併所有 dupIds，一次批次查詢
  const dupIds = [...new Set([
    ...rawNameDuplicates.flat().map((s) => s.id),
    ...sameParentDuplicates.flat().map((s) => s.id),
  ])];

  // Step D：一次批次查詢家長資料與課程
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

  function toGroup(rawGroup: RawStudent[]): DuplicateGroup {
    return rawGroup.map((s) => ({
      id: s.id,
      name: s.name,
      english_name: s.english_name,
      campus: s.campus,
      id_number: s.id_number,
      parents: parentMap[s.id] ?? [],
      courses: courseMap[s.id] ?? [],
    }));
  }

  const duplicateGroups: DuplicateGroup[] = rawNameDuplicates.map(toGroup);
  const sameParentGroups: DuplicateGroup[] = sameParentDuplicates.map(toGroup);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">學生資料審核</h1>

      {/* 同名同英文名重複警示 */}
      {duplicateGroups.length > 0 && (
        <DuplicateStudentAlert groups={duplicateGroups} />
      )}

      {/* 同家長疑似重複建檔（不同中文名、同英文名） */}
      {sameParentGroups.length > 0 && (
        <div className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-amber-700">同家長疑似重複建檔</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              以下學生由同一家長連結、英文名相同但中文名不同，可能是報名表填錯姓名所致。
            </p>
          </div>
          <DuplicateStudentAlert groups={sameParentGroups} />
        </div>
      )}

      {/* 姓名填寫錯誤核對 */}
      {nameMismatchPending.length > 0 && (
        <div className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">姓名填寫錯誤核對</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              表單填寫的姓名與系統記錄不符，經電話及英文名比對後找到對應學生，請確認是否為同一人。
            </p>
          </div>
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">系統學生</th>
                  <th className="text-left px-4 py-2 font-medium">表單填寫名稱</th>
                  <th className="text-left px-4 py-2 font-medium">比對依據</th>
                  <th className="text-left px-4 py-2 font-medium">時間</th>
                  <th className="w-36"></th>
                </tr>
              </thead>
              <tbody>
                {nameMismatchPending.map((r: any) => {
                  const student = r.students as { id: string; name: string } | null;
                  const changes = r.proposed_changes as Record<string, { old: unknown; new: unknown }>;
                  return (
                    <tr key={r.id} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-2 font-medium">{student?.name ?? '—'}</td>
                      <td className="px-4 py-2 text-amber-600 font-medium">
                        {String(changes.survey_name?.old ?? '—')}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">
                        {String(changes.match_basis?.new ?? '—')}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">
                        {new Date(r.created_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-2">
                          <form action={approveStudentReview.bind(null, r.id)}>
                            <Button size="sm" variant="default" type="submit">確認</Button>
                          </form>
                          <form action={rejectStudentReview.bind(null, r.id)}>
                            <Button size="sm" variant="outline" type="submit">存疑</Button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 待審核資料變更 */}
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          以下學生在重新填寫報名表時，資料與原有記錄不符，請確認後核准或拒絕變更。
        </p>
        {fieldChangePending.length === 0 ? (
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
                {fieldChangePending.map((r: any) => {
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
