export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { getGrade } from '@/lib/grade';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

const CAMPUSES = ['文府總校', '龍華校', '左新校'] as const;
const CAMPUS_SHORT: Record<string, string> = { '文府總校': '文府', '龍華校': '龍華', '左新校': '左新' };
const GRADE_ORDER = ['大班升小一', '小一', '小二', '小三', '小四', '小五', '小六'];

const TYPE_LABEL: Record<string, string> = {
  main_course: '基本課程', camp: '營隊', trip: '校外活動',
};
const TYPE_ORDER: Record<string, number> = { main_course: 0, camp: 1, trip: 2 };

function tripSortKey(name: string): [number, number, number] {
  if (name.includes('兩天一夜')) return [0, 0, 0];
  const m = name.match(/^(\d+)\/(\d+)/);
  return m ? [1, parseInt(m[1]), parseInt(m[2])] : [1, 99, 99];
}
const TYPE_BADGE: Record<string, string> = {
  main_course: 'bg-primary text-primary-foreground',
  camp: 'bg-secondary text-secondary-foreground',
  trip: 'border border-input text-foreground',
};

export default async function CourseStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const supabase = createServerClient();

  const [{ data: courses }, { data: students }] = await Promise.all([
    supabase.from('courses').select('id, name, course_type, max_capacity').neq('course_type', 'material'),
    supabase.from('students').select('id, enrollment_date'),
  ]);

  // 分頁撈完所有合約（Supabase 每次最多 1000 筆）
  const enrollments: any[] = [];
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const { data } = await supabase
      .from('enrollments')
      .select('course_id, campus, status, student_id')
      .in('status', ['生效', '候補'])
      .range(offset, offset + PAGE - 1);
    if (!data || data.length === 0) break;
    enrollments.push(...data);
    if (data.length < PAGE) break;
  }

  const studentGrade: Record<string, string> = {};
  for (const s of students ?? []) {
    studentGrade[(s as any).id] = getGrade((s as any).enrollment_date);
  }

  const totalMap: Record<string, { active: number; waitlist: number }> = {};
  const byCampus: Record<string, Record<string, { active: number; waitlist: number }>> = {};
  const byGrade: Record<string, Record<string, number>> = {};
  const byCourseGradeCampus: Record<string, Record<string, Record<string, Set<string>>>> = {};

  for (const e of enrollments ?? []) {
    const { course_id, campus, status, student_id } = e as any;
    const cp: string = campus ?? '其他';

    if (!totalMap[course_id]) totalMap[course_id] = { active: 0, waitlist: 0 };
    if (!byCampus[course_id]) byCampus[course_id] = {};
    if (!byCampus[course_id][cp]) byCampus[course_id][cp] = { active: 0, waitlist: 0 };

    if (status === '生效') {
      totalMap[course_id].active++;
      byCampus[course_id][cp].active++;
      const grade = studentGrade[student_id] ?? '未知';
      if (!byGrade[course_id]) byGrade[course_id] = {};
      byGrade[course_id][grade] = (byGrade[course_id][grade] ?? 0) + 1;
      if (!byCourseGradeCampus[course_id]) byCourseGradeCampus[course_id] = {};
      if (!byCourseGradeCampus[course_id][grade]) byCourseGradeCampus[course_id][grade] = {};
      if (!byCourseGradeCampus[course_id][grade][cp]) byCourseGradeCampus[course_id][grade][cp] = new Set();
      byCourseGradeCampus[course_id][grade][cp].add(student_id);
    } else {
      totalMap[course_id].waitlist++;
      byCampus[course_id][cp].waitlist++;
    }
  }

  const allRows = (courses ?? [])
    .filter((c: any) => (totalMap[c.id]?.active ?? 0) > 0 || (totalMap[c.id]?.waitlist ?? 0) > 0)
    .map((c: any) => ({
      ...c,
      ids: [c.id],
      active: totalMap[c.id]?.active ?? 0,
      waitlist: totalMap[c.id]?.waitlist ?? 0,
      campusCounts: byCampus[c.id] ?? {},
      gradeCounts: byGrade[c.id] ?? {},
    }))
    .sort((a: any, b: any) => {
      const td = (TYPE_ORDER[a.course_type] ?? 9) - (TYPE_ORDER[b.course_type] ?? 9);
      if (td !== 0) return td;
      if (a.course_type === 'trip') {
        const [pa, ma, da] = tripSortKey(a.name);
        const [pb, mb, db] = tripSortKey(b.name);
        if (pa !== pb) return pa - pb;
        if (ma !== mb) return ma - mb;
        return da - db;
      }
      return a.name.localeCompare(b.name, 'zh-TW');
    });

  // Merge courses that differ only by group suffix（升小一）/（二至六年級）
  function stripGroupSuffix(name: string): string | null {
    if (name.endsWith('（升小一）')) return name.slice(0, -5);
    if (name.endsWith('（二至六年級）')) return name.slice(0, -7);
    return null;
  }

  const mergeMap = new Map<string, any[]>();
  const soloRows: any[] = [];
  for (const r of allRows) {
    const base = stripGroupSuffix(r.name);
    if (base !== null) {
      const key = `${base}||${r.course_type}`;
      if (!mergeMap.has(key)) mergeMap.set(key, []);
      mergeMap.get(key)!.push(r);
    } else {
      soloRows.push(r);
    }
  }

  const mergedList: any[] = [...soloRows];
  for (const [key, grp] of mergeMap.entries()) {
    if (grp.length < 2) { mergedList.push(...grp); continue; }
    const baseName = key.split('||')[0];
    const campusCounts: Record<string, { active: number; waitlist: number }> = {};
    const gradeCounts: Record<string, number> = {};
    for (const r of grp) {
      for (const [cp, v] of Object.entries(r.campusCounts as Record<string, { active: number; waitlist: number }>)) {
        if (!campusCounts[cp]) campusCounts[cp] = { active: 0, waitlist: 0 };
        campusCounts[cp].active += v.active;
        campusCounts[cp].waitlist += v.waitlist;
      }
      for (const [grade, cnt] of Object.entries(r.gradeCounts as Record<string, number>)) {
        gradeCounts[grade] = (gradeCounts[grade] ?? 0) + cnt;
      }
    }
    mergedList.push({
      id: grp[0].id,
      ids: grp.map((r: any) => r.id),
      name: baseName,
      course_type: grp[0].course_type,
      max_capacity: grp.every((r: any) => r.max_capacity != null)
        ? grp.reduce((s: number, r: any) => s + r.max_capacity, 0)
        : null,
      active: grp.reduce((s: number, r: any) => s + r.active, 0),
      waitlist: grp.reduce((s: number, r: any) => s + r.waitlist, 0),
      campusCounts,
      gradeCounts,
    });
  }

  const rows = mergedList.sort((a: any, b: any) => {
    const td = (TYPE_ORDER[a.course_type] ?? 9) - (TYPE_ORDER[b.course_type] ?? 9);
    return td !== 0 ? td : a.name.localeCompare(b.name, 'zh-TW');
  });

  const alertRows = rows
    .filter((r: any) => r.waitlist > 0 || (r.max_capacity && r.active / r.max_capacity >= 0.8))
    .sort((a: any, b: any) => {
      const hasWaitA = a.waitlist > 0 ? 1 : 0;
      const hasWaitB = b.waitlist > 0 ? 1 : 0;
      if (hasWaitB !== hasWaitA) return hasWaitB - hasWaitA;
      const pa = a.max_capacity ? a.active / a.max_capacity : 0;
      const pb = b.max_capacity ? b.active / b.max_capacity : 0;
      return pb - pa;
    });

  const gradeSummary: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    for (const [grade, count] of Object.entries(r.gradeCounts as Record<string, number>)) {
      if (!gradeSummary[grade]) gradeSummary[grade] = {};
      gradeSummary[grade][r.course_type] = (gradeSummary[grade]?.[r.course_type] ?? 0) + count;
    }
  }
  const activeGrades = GRADE_ORDER.filter(g => gradeSummary[g]);

  const crossGradeCampusSet: Record<string, Record<string, Set<string>>> = {};
  for (const r of rows) {
    for (const id of (r.ids as string[])) {
      for (const [grade, campusMap] of Object.entries(byCourseGradeCampus[id] ?? {})) {
        for (const [cp, set] of Object.entries(campusMap)) {
          if (!crossGradeCampusSet[grade]) crossGradeCampusSet[grade] = {};
          if (!crossGradeCampusSet[grade][cp]) crossGradeCampusSet[grade][cp] = new Set();
          set.forEach(sid => crossGradeCampusSet[grade][cp].add(sid));
        }
      }
    }
  }
  const crossGradeCampus: Record<string, Record<string, number>> = {};
  for (const [grade, campusMap] of Object.entries(crossGradeCampusSet)) {
    crossGradeCampus[grade] = {};
    for (const [cp, set] of Object.entries(campusMap)) {
      crossGradeCampus[grade][cp] = set.size;
    }
  }
  const crossGrades = GRADE_ORDER.filter(g => crossGradeCampus[g]);

  const totalActive = rows.reduce((s: number, r: any) => s + r.active, 0);
  const totalWaitlist = rows.reduce((s: number, r: any) => s + r.waitlist, 0);

  const isGradeView = view === 'grade';
  const isCrossView = view === 'cross';

  function tabCls(active: boolean) {
    return `text-xs px-3 py-1.5 rounded-md border transition-colors ${
      active ? 'bg-primary text-primary-foreground border-primary' : 'border-input hover:bg-muted'
    }`;
  }
  function viewHref(v?: string) {
    return v ? `/courses/stats?view=${v}` : '/courses/stats';
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">課程報名統計</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            共 {rows.length} 門課程・生效 {totalActive} 人次・候補 {totalWaitlist} 人次
          </p>
        </div>
        <div className="flex gap-1.5 ml-auto">
          <Link href={viewHref()} className={tabCls(!isGradeView && !isCrossView)}>校區分布</Link>
          <Link href={viewHref('grade')} className={tabCls(isGradeView)}>年級分布</Link>
          <Link href={viewHref('cross')} className={tabCls(isCrossView)}>校區×年級</Link>
        </div>
      </div>

      {/* Alert banner */}
      {alertRows.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-2">
          <p className="text-xs font-semibold text-amber-800">⚠ 需注意（候補中或 ≥ 80% 額滿）</p>
          <div className="flex flex-wrap gap-2">
            {alertRows.map((r: any) => {
              const pct = r.max_capacity ? Math.round((r.active / r.max_capacity) * 100) : null;
              const full = pct !== null && pct >= 100;
              const hasWait = r.waitlist > 0;
              return (
                <div
                  key={r.id}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                    full || hasWait ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-100 border-amber-300 text-amber-900'
                  }`}
                >
                  <span>{r.name}</span>
                  {pct !== null && <span className="opacity-60">{r.active}/{r.max_capacity}</span>}
                  {hasWait && (
                    <span className="bg-red-600 text-white px-1.5 py-0.5 rounded-full leading-none">
                      候補 {r.waitlist}
                    </span>
                  )}
                  {full && !hasWait && <span className="font-bold">額滿</span>}
                  {!full && pct !== null && <span>{pct}%</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Campus view */}
      {!isGradeView && !isCrossView && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>課程名稱</TableHead>
              <TableHead className="w-24">類型</TableHead>
              {CAMPUSES.map(c => (
                <TableHead key={c} className="w-16 text-right">{CAMPUS_SHORT[c]}</TableHead>
              ))}
              <TableHead className="w-16 text-right">合計</TableHead>
              <TableHead className="w-16 text-right">候補</TableHead>
              <TableHead className="w-16 text-right">上限</TableHead>
              <TableHead className="w-36">使用率</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                  目前無報名資料
                </TableCell>
              </TableRow>
            )}
            {rows.map((r: any) => {
              const pct = r.max_capacity ? Math.round((r.active / r.max_capacity) * 100) : null;
              const full = pct !== null && pct >= 100;
              const nearFull = !full && pct !== null && pct >= 80;
              return (
                <TableRow
                  key={r.id}
                  className={full || r.waitlist > 0 ? 'bg-red-50/40' : nearFull ? 'bg-amber-50/30' : ''}
                >
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGE[r.course_type] ?? 'border border-input'}`}>
                      {TYPE_LABEL[r.course_type] ?? r.course_type}
                    </span>
                  </TableCell>
                  {CAMPUSES.map(c => {
                    const cnt = (r.campusCounts as any)[c];
                    return (
                      <TableCell key={c} className="text-right tabular-nums text-sm">
                        {cnt?.active > 0 ? (
                          <>
                            {cnt.active}
                            {cnt.waitlist > 0 && (
                              <span className="text-xs text-red-500 ml-0.5">+{cnt.waitlist}</span>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right tabular-nums font-semibold">{r.active}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.waitlist > 0
                      ? <span className="text-red-600 font-medium">{r.waitlist}</span>
                      : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {r.max_capacity ?? '不限'}
                  </TableCell>
                  <TableCell>
                    {pct !== null ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${full ? 'bg-red-500' : nearFull ? 'bg-amber-400' : 'bg-teal-500'}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <span className={`text-xs tabular-nums w-14 text-right ${full ? 'text-red-600 font-semibold' : nearFull ? 'text-amber-600 font-medium' : 'text-muted-foreground'}`}>
                          {pct}%{full && ' 額滿'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">不限</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {/* Grade view */}
      {isGradeView && (
        <div className="space-y-8">
          <div>
            <h2 className="text-sm font-semibold mb-3">各年級報名分布（生效人次）</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>年級</TableHead>
                  <TableHead className="text-right">基本課程</TableHead>
                  <TableHead className="text-right">營隊</TableHead>
                  <TableHead className="text-right">校外活動</TableHead>
                  <TableHead className="text-right font-semibold">合計人次</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeGrades.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">無資料</TableCell>
                  </TableRow>
                )}
                {activeGrades.map(grade => {
                  const dist = gradeSummary[grade] ?? {};
                  const main = dist['main_course'] ?? 0;
                  const camp = dist['camp'] ?? 0;
                  const trip = dist['trip'] ?? 0;
                  const total = main + camp + trip;
                  return (
                    <TableRow key={grade}>
                      <TableCell className="font-medium">{grade}</TableCell>
                      <TableCell className="text-right tabular-nums">{main || '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{camp || '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{trip || '—'}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{total}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div>
            <h2 className="text-sm font-semibold mb-3">各課程年級明細</h2>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-40">課程名稱</TableHead>
                    <TableHead className="w-24">類型</TableHead>
                    {GRADE_ORDER.map(g => (
                      <TableHead key={g} className="text-right w-16 text-xs whitespace-nowrap">{g}</TableHead>
                    ))}
                    <TableHead className="text-right w-16 font-semibold">合計</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">無資料</TableCell>
                    </TableRow>
                  )}
                  {rows.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGE[r.course_type] ?? 'border border-input'}`}>
                          {TYPE_LABEL[r.course_type] ?? r.course_type}
                        </span>
                      </TableCell>
                      {GRADE_ORDER.map(g => {
                        const cnt = (r.gradeCounts as Record<string, number>)[g] ?? 0;
                        return (
                          <TableCell key={g} className="text-right tabular-nums text-sm">
                            {cnt > 0 ? cnt : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right tabular-nums font-semibold">{r.active}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {/* Cross view: grade × campus */}
      {isCrossView && (
        <div className="space-y-8">
          <div>
            <h2 className="text-sm font-semibold mb-3">各年級在各校區的生效報名人次</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>年級</TableHead>
                  {CAMPUSES.map(c => (
                    <TableHead key={c} className="text-right w-20">{CAMPUS_SHORT[c]}</TableHead>
                  ))}
                  <TableHead className="text-right w-20 font-semibold">合計</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {crossGrades.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">無資料</TableCell>
                  </TableRow>
                )}
                {crossGrades.map(grade => {
                  const rowTotal = CAMPUSES.reduce((s, c) => s + (crossGradeCampus[grade]?.[c] ?? 0), 0);
                  return (
                    <TableRow key={grade}>
                      <TableCell className="font-medium">{grade}</TableCell>
                      {CAMPUSES.map(c => {
                        const count = crossGradeCampus[grade]?.[c] ?? 0;
                        return (
                          <TableCell key={c} className="text-right tabular-nums text-sm">
                            {count > 0 ? count : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right tabular-nums font-semibold">{rowTotal}</TableCell>
                    </TableRow>
                  );
                })}
                {crossGrades.length > 0 && (
                  <TableRow className="bg-muted/50">
                    <TableCell className="font-bold">合計</TableCell>
                    {CAMPUSES.map(c => {
                      const colTotal = crossGrades.reduce((s, g) => s + (crossGradeCampus[g]?.[c] ?? 0), 0);
                      return (
                        <TableCell key={c} className="text-right tabular-nums font-bold">
                          {colTotal > 0 ? colTotal : '—'}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right tabular-nums font-bold">
                      {crossGrades.reduce((s, g) => s + CAMPUSES.reduce((s2, c) => s2 + (crossGradeCampus[g]?.[c] ?? 0), 0), 0)}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div>
            <h2 className="text-sm font-semibold mb-3">各課程校區×年級明細</h2>
            <div className="space-y-4">
              {rows.map((r: any) => {
                const courseDetail: Record<string, Record<string, number>> = {};
                for (const id of (r.ids as string[])) {
                  for (const [grade, campusMap] of Object.entries(byCourseGradeCampus[id] ?? {})) {
                    if (!courseDetail[grade]) courseDetail[grade] = {};
                    for (const [cp, set] of Object.entries(campusMap)) {
                      courseDetail[grade][cp] = (courseDetail[grade][cp] ?? 0) + set.size;
                    }
                  }
                }
                const courseGrades = GRADE_ORDER.filter(g =>
                  CAMPUSES.some(c => (courseDetail[g]?.[c] ?? 0) > 0)
                );
                if (courseGrades.length === 0) return null;
                return (
                  <div key={r.id} className="rounded-lg border overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 border-b">
                      <span className="font-medium text-sm">{r.name}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGE[r.course_type] ?? 'border border-input'}`}>
                        {TYPE_LABEL[r.course_type] ?? r.course_type}
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto">合計 {r.active} 人</span>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>年級</TableHead>
                          {CAMPUSES.map(c => (
                            <TableHead key={c} className="text-right w-20">{CAMPUS_SHORT[c]}</TableHead>
                          ))}
                          <TableHead className="text-right w-20 font-semibold">小計</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {courseGrades.map(grade => {
                          const rowTotal = CAMPUSES.reduce((s, c) => s + (courseDetail[grade]?.[c] ?? 0), 0);
                          return (
                            <TableRow key={grade}>
                              <TableCell className="font-medium text-sm">{grade}</TableCell>
                              {CAMPUSES.map(c => {
                                const count = courseDetail[grade]?.[c] ?? 0;
                                return (
                                  <TableCell key={c} className="text-right tabular-nums text-sm">
                                    {count > 0 ? count : <span className="text-muted-foreground">—</span>}
                                  </TableCell>
                                );
                              })}
                              <TableCell className="text-right tabular-nums font-semibold text-sm">{rowTotal}</TableCell>
                            </TableRow>
                          );
                        })}
                        <TableRow className="bg-muted/50">
                          <TableCell className="font-bold text-sm">合計</TableCell>
                          {CAMPUSES.map(c => {
                            const colTotal = courseGrades.reduce((s, g) => s + (courseDetail[g]?.[c] ?? 0), 0);
                            return (
                              <TableCell key={c} className="text-right tabular-nums font-bold text-sm">
                                {colTotal > 0 ? colTotal : '—'}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-right tabular-nums font-bold text-sm">{r.active}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
