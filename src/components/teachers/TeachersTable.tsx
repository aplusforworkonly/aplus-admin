'use client';
import { useState, useTransition, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { toggleSupervisor, getSupervisorAccess, setSupervisorAccess } from '@/actions/teachers';
import { Settings, ChevronDown, ChevronUp } from 'lucide-react';

const CAMPUSES = ['文府總校', '龍華校', '左新校'];

type Teacher = {
  id: string;
  name: string;
  english_name: string | null;
  email: string;
  campus: string | null;
  department: string | null;
  user_id: string | null;
  is_supervisor: boolean;
};

// ── 督導開關 ──────────────────────────────────────────────
function SupervisorToggle({ id, initial }: { id: string; initial: boolean }) {
  const [isSuper, setIsSuper] = useState(initial);
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    const next = !isSuper;
    setIsSuper(next);
    startTransition(async () => {
      try { await toggleSupervisor(id, next); }
      catch { setIsSuper(!next); }
    });
  }

  return (
    <button
      onClick={handleToggle}
      disabled={pending}
      title={isSuper ? '點擊取消督導權限' : '點擊設為督導'}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
        isSuper ? 'bg-teal-600' : 'bg-slate-200'
      }`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
        isSuper ? 'translate-x-4' : 'translate-x-0.5'
      }`} />
    </button>
  );
}

// ── 可見範圍設定面板 ──────────────────────────────────────
function SupervisorAccessRow({
  supervisorId,
  allActiveTeachers,
  onClose,
}: {
  supervisorId: string;
  allActiveTeachers: Teacher[];
  onClose: () => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, startTransition] = useTransition();

  useEffect(() => {
    getSupervisorAccess(supervisorId).then((ids) => {
      setSelectedIds(ids);
      setLoaded(true);
    });
  }, [supervisorId]);

  const candidates = allActiveTeachers.filter(t => t.id !== supervisorId);

  function toggle(id: string) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function toggleAll() {
    const allIds = candidates.map(t => t.id);
    setSelectedIds(prev => prev.length === candidates.length ? [] : allIds);
  }

  function handleSave() {
    startTransition(async () => {
      await setSupervisorAccess(supervisorId, selectedIds);
      onClose();
    });
  }

  const campusGroups = CAMPUSES.map(campus => ({
    campus,
    teachers: candidates.filter(t => t.campus === campus),
  })).filter(g => g.teachers.length > 0);

  const othersGroup = candidates.filter(t => !CAMPUSES.includes(t.campus ?? ''));

  return (
    <TableRow className="bg-amber-50/60 hover:bg-amber-50/60">
      <TableCell colSpan={6} className="py-4 px-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-amber-800">
              可見老師範圍
              <span className="ml-2 text-xs font-normal text-amber-600">
                （未勾選任何人＝預設可見全部）
              </span>
            </p>
            <button
              onClick={toggleAll}
              className="text-xs text-teal-700 hover:underline"
            >
              {selectedIds.length === candidates.length ? '取消全選' : '全選'}
            </button>
          </div>

          {!loaded ? (
            <p className="text-xs text-muted-foreground">載入中…</p>
          ) : (
            <div className="space-y-3">
              {campusGroups.map(({ campus, teachers }) => (
                <div key={campus}>
                  <p className="text-xs text-muted-foreground font-medium mb-1.5">{campus}</p>
                  <div className="flex flex-wrap gap-x-6 gap-y-1.5">
                    {teachers.map(t => (
                      <label key={t.id} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(t.id)}
                          onChange={() => toggle(t.id)}
                          className="rounded"
                        />
                        <span className="text-sm">
                          {t.name}
                          {t.english_name && (
                            <span className="text-xs text-muted-foreground ml-1">({t.english_name})</span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              {othersGroup.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1.5">其他</p>
                  <div className="flex flex-wrap gap-x-6 gap-y-1.5">
                    {othersGroup.map(t => (
                      <label key={t.id} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(t.id)}
                          onChange={() => toggle(t.id)}
                          className="rounded"
                        />
                        <span className="text-sm">{t.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving || !loaded}
              className="h-7 px-3 text-xs rounded-md bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-50 transition-colors"
            >
              {saving ? '儲存中…' : '儲存'}
            </button>
            <button
              onClick={onClose}
              className="h-7 px-3 text-xs rounded-md border border-input hover:bg-muted transition-colors"
            >
              取消
            </button>
            {selectedIds.length > 0 && (
              <span className="text-xs text-muted-foreground ml-1">
                已勾選 {selectedIds.length} 位老師
              </span>
            )}
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ── 主元件 ───────────────────────────────────────────────
export default function TeachersTable({
  teachers,
  allActiveTeachers,
}: {
  teachers: Teacher[];
  allActiveTeachers: Teacher[];
}) {
  const [search, setSearch] = useState('');
  const [campusFilter, setCampusFilter] = useState('all');
  const [expandedSupervisorId, setExpandedSupervisorId] = useState<string | null>(null);

  const filtered = teachers.filter((t) => {
    const matchSearch = !search.trim()
      || t.name.includes(search.trim())
      || (t.english_name ?? '').toLowerCase().includes(search.trim().toLowerCase())
      || (t.email ?? '').toLowerCase().includes(search.trim().toLowerCase());
    const matchCampus = campusFilter === 'all' || t.campus === campusFilter;
    return matchSearch && matchCampus;
  });

  const selectCls = 'h-8 rounded-md border border-input bg-background px-2 text-sm';

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          placeholder="搜尋姓名或 Email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs h-8 text-sm"
        />
        <select
          className={selectCls}
          value={campusFilter}
          onChange={(e) => setCampusFilter(e.target.value)}
        >
          <option value="all">全部校區</option>
          {CAMPUSES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground ml-auto">
          {search || campusFilter !== 'all'
            ? `${filtered.length} / ${teachers.length} 人`
            : `共 ${teachers.length} 人`}
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>姓名</TableHead>
            <TableHead>部門</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>校區</TableHead>
            <TableHead className="w-24 text-center">帳號狀態</TableHead>
            <TableHead className="w-32 text-center">督導權限</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                {search || campusFilter !== 'all' ? '找不到符合的老師' : '尚無老師資料'}
              </TableCell>
            </TableRow>
          )}
          {filtered.map((t) => (
            <>
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
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <SupervisorToggle id={t.id} initial={t.is_supervisor} />
                    {t.is_supervisor && (
                      <button
                        onClick={() => setExpandedSupervisorId(
                          expandedSupervisorId === t.id ? null : t.id
                        )}
                        title="設定可見範圍"
                        className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      >
                        {expandedSupervisorId === t.id
                          ? <ChevronUp className="w-3.5 h-3.5" />
                          : <Settings className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
              {expandedSupervisorId === t.id && (
                <SupervisorAccessRow
                  key={`${t.id}-access`}
                  supervisorId={t.id}
                  allActiveTeachers={allActiveTeachers}
                  onClose={() => setExpandedSupervisorId(null)}
                />
              )}
            </>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
