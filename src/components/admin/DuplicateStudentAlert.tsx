'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { mergeStudents } from '@/actions/student-reviews';

export type ParentLink = {
  mappingId: string;
  parentId: string;
  name: string;
  phone: string;
};

export type DuplicateStudent = {
  id: string;
  name: string;
  english_name: string | null;
  campus: string | null;
  id_number: string | null;
  parents: ParentLink[];
  courses: string[];
};

export type DuplicateGroup = DuplicateStudent[];

const COPYABLE_FIELDS: { key: keyof DuplicateStudent; label: string }[] = [
  { key: 'id_number', label: '身分證字號' },
  { key: 'english_name', label: '英文名' },
  { key: 'campus', label: '校區' },
];

function groupKey(g: DuplicateGroup) {
  return g.map((s) => s.id).sort().join('|');
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <div className="text-sm">{value ?? <span className="text-muted-foreground">—</span>}</div>
    </div>
  );
}

function StudentCard({
  student,
  isKept,
  isDeleted,
  onSelect,
}: {
  student: DuplicateStudent;
  isKept: boolean;
  isDeleted: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={`flex-1 rounded-lg border p-4 space-y-3 transition-colors ${
        isKept
          ? 'border-blue-500 bg-blue-50/50'
          : isDeleted
          ? 'border-red-300 bg-red-50/30 opacity-75'
          : 'border-border bg-background'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-mono text-muted-foreground truncate">{student.id}</span>
        {isKept ? (
          <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-blue-500 text-white font-medium">保留</span>
        ) : isDeleted ? (
          <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-red-400 text-white font-medium">刪除</span>
        ) : (
          <Button size="sm" variant="outline" className="shrink-0 h-6 text-xs px-2" onClick={onSelect}>
            保留這筆
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="中文姓名" value={student.name} />
        <Field label="英文名" value={student.english_name} />
        <Field label="校區" value={student.campus} />
        <Field label="身分證字號" value={student.id_number} />
      </div>
      <Field
        label="家長"
        value={
          student.parents.length > 0
            ? student.parents.map((p) => `${p.name}（${p.phone}）`).join('、')
            : null
        }
      />
      <Field
        label="生效課程"
        value={
          student.courses.length > 0 ? (
            <div className="flex flex-wrap gap-1 mt-0.5">
              {student.courses.map((c, i) => (
                <span key={i} className="text-xs px-2 py-0.5 rounded-full border bg-muted text-muted-foreground">
                  {c}
                </span>
              ))}
            </div>
          ) : null
        }
      />
    </div>
  );
}

function GroupCard({ group, onMerged }: { group: DuplicateGroup; onMerged: () => void }) {
  const [keepId, setKeepId] = useState<string | null>(null);
  const [fieldOverrides, setFieldOverrides] = useState<Record<string, string>>({});
  const [skippedMappingIds, setSkippedMappingIds] = useState<Set<string>>(new Set());
  const [merging, startMerge] = useTransition();
  const [mergeError, setMergeError] = useState<string | null>(null);

  const kept = keepId ? group.find((s) => s.id === keepId) ?? null : null;
  const deleted = keepId ? group.find((s) => s.id !== keepId) ?? null : null;

  // Fields in deleted student that kept student is missing or has different value
  const copyableFields = kept && deleted
    ? COPYABLE_FIELDS.filter(({ key }) => {
        const deletedVal = deleted[key] as string | null;
        const keptVal = kept[key] as string | null;
        return deletedVal && deletedVal !== keptVal;
      })
    : [];

  // Parents in deleted student that would be transferred to kept student
  // (parents already on kept student by same parent_id are deduplicated automatically)
  const keptParentIds = new Set(kept?.parents.map((p) => p.parentId) ?? []);
  const transferableParents = deleted?.parents.filter((p) => !keptParentIds.has(p.parentId)) ?? [];

  function toggleOverride(key: string, value: string) {
    setFieldOverrides((prev) => {
      if (prev[key] === value) { const next = { ...prev }; delete next[key]; return next; }
      return { ...prev, [key]: value };
    });
  }

  function toggleMapping(mappingId: string) {
    setSkippedMappingIds((prev) => {
      const next = new Set(prev);
      if (next.has(mappingId)) next.delete(mappingId);
      else next.add(mappingId);
      return next;
    });
  }

  function handleSelect(id: string) {
    setKeepId(id);
    setFieldOverrides({});
    setSkippedMappingIds(new Set());
  }

  function handleMerge() {
    if (!keepId || !deleted) return;
    setMergeError(null);
    startMerge(async () => {
      const result = await mergeStudents(
        keepId,
        deleted.id,
        Object.keys(fieldOverrides).length > 0 ? fieldOverrides : undefined,
        skippedMappingIds.size > 0 ? [...skippedMappingIds] : undefined,
      );
      if (!result.ok) {
        setMergeError(result.error);
        return;
      }
      onMerged();
    });
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-4 space-y-4">
      <p className="text-sm font-semibold text-amber-800">
        {group[0].name}
        {group[0].english_name ? `（${group[0].english_name}）` : ''}
        — {group.length} 筆重複
      </p>

      <div className="flex gap-3">
        {group.map((s) => (
          <StudentCard
            key={s.id}
            student={s}
            isKept={keepId === s.id}
            isDeleted={!!keepId && keepId !== s.id}
            onSelect={() => handleSelect(s.id)}
          />
        ))}
      </div>

      {keepId && deleted && (
        <div className="space-y-3">
          {/* 家長轉移預覽 */}
          {transferableParents.length > 0 && (
            <div className="rounded-lg border border-green-200 bg-green-50/40 p-3 space-y-2">
              <p className="text-xs font-medium text-green-800">
                以下家長關係將從「刪除」那筆轉移過來，取消勾選可跳過：
              </p>
              <div className="space-y-1.5">
                {transferableParents.map((p) => (
                  <label key={p.mappingId} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={!skippedMappingIds.has(p.mappingId)}
                      onChange={() => toggleMapping(p.mappingId)}
                    />
                    <span className="font-medium">{p.name}</span>
                    <span className="text-muted-foreground">（{p.phone}）</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* 欄位補齊選項 */}
          {copyableFields.length > 0 && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3 space-y-2">
              <p className="text-xs font-medium text-blue-800">
                要將以下欄位從「刪除」那筆複製到「保留」那筆嗎？
              </p>
              <div className="space-y-1.5">
                {copyableFields.map(({ key, label }) => {
                  const val = (deleted[key] as string | null) ?? '';
                  const checked = fieldOverrides[key] === val;
                  return (
                    <label key={key} className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={checked}
                        onChange={() => toggleOverride(key, val)}
                      />
                      <span className="text-muted-foreground">{label}：</span>
                      <span className="font-medium">{val}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {mergeError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              ⚠ 合併失敗：{mergeError}
            </div>
          )}
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              所有課程、帳單、請假等紀錄會自動轉移到「保留」那筆，另一筆標記為「重複建檔」。
            </p>
            <Button size="sm" variant="destructive" onClick={handleMerge} disabled={merging}>
              {merging ? '合併中…' : '確認合併'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DuplicateStudentAlert({ groups }: { groups: DuplicateGroup[] }) {
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());

  function handleMerged(key: string) {
    setHiddenKeys((prev) => new Set([...prev, key]));
  }

  const visibleGroups = groups.filter((g) => !hiddenKeys.has(groupKey(g)));

  if (visibleGroups.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-amber-700">⚠ 疑似重複學生</span>
        <span className="text-xs text-muted-foreground">
          共 {visibleGroups.length} 組，請選擇要保留的那筆後執行合併
        </span>
      </div>
      <div className="space-y-3">
        {visibleGroups.map((group) => {
          const key = groupKey(group);
          return <GroupCard key={key} group={group} onMerged={() => handleMerged(key)} />;
        })}
      </div>
    </div>
  );
}
