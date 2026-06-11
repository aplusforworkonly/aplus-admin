'use client';
import { useState, useTransition, useEffect, useRef } from 'react';
import { Settings, X } from 'lucide-react';
import { toggleSupervisor, getSupervisorAccess, setSupervisorAccess } from '@/actions/teachers';
import { CAMPUSES } from '@/lib/constants';


type Teacher = {
  id: string;
  name: string;
  english_name: string | null;
  campus: string | null;
};

export default function SupervisorCell({
  teacherId,
  initial,
  allTeachers,
}: {
  teacherId: string;
  initial: boolean;
  allTeachers: Teacher[];
}) {
  const [isSuper, setIsSuper] = useState(initial);
  const [showSettings, setShowSettings] = useState(false);
  const [pending, startToggle] = useTransition();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, startSave] = useTransition();

  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showSettings) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showSettings]);

  function handleToggle() {
    const next = !isSuper;
    setIsSuper(next);
    if (!next) setShowSettings(false);
    startToggle(async () => {
      try { await toggleSupervisor(teacherId, next); }
      catch { setIsSuper(!next); }
    });
  }

  function openSettings() {
    setShowSettings(true);
    if (!loaded) {
      getSupervisorAccess(teacherId).then((ids) => {
        setSelectedIds(ids);
        setLoaded(true);
      });
    }
  }

  function toggleId(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const candidates = allTeachers.filter((t) => t.id !== teacherId);

  function handleSave() {
    startSave(async () => {
      await setSupervisorAccess(teacherId, selectedIds);
      setShowSettings(false);
    });
  }

  const campusGroups = CAMPUSES.map((campus) => ({
    campus,
    teachers: candidates.filter((t) => t.campus === campus),
  })).filter((g) => g.teachers.length > 0);

  const others = candidates.filter((t) => !(CAMPUSES as readonly string[]).includes(t.campus ?? ''));

  return (
    <div className="relative flex items-center justify-center gap-2">
      {/* Toggle */}
      <button
        onClick={handleToggle}
        disabled={pending}
        title={isSuper ? '點擊取消督導權限' : '點擊設為督導'}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
          isSuper ? 'bg-teal-600' : 'bg-slate-200'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            isSuper ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>

      {/* Gear button — only when supervisor is on */}
      {isSuper && (
        <button
          onClick={openSettings}
          title="設定可見老師範圍"
          className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Settings popover */}
      {showSettings && (
        <div
          ref={panelRef}
          className="absolute right-0 bottom-full z-50 mb-2 w-80 bg-background border rounded-lg shadow-xl p-4 space-y-3 text-left"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-amber-800">
              可見老師範圍
              <span className="ml-1.5 text-xs font-normal text-amber-600">
                （空白＝可見全部）
              </span>
            </p>
            <button
              onClick={() => setShowSettings(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {!loaded ? (
            <p className="text-xs text-muted-foreground">載入中…</p>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {campusGroups.map(({ campus, teachers }) => (
                <div key={campus}>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">{campus}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                    {teachers.map((t) => (
                      <label key={t.id} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(t.id)}
                          onChange={() => toggleId(t.id)}
                          className="rounded"
                        />
                        <span className="text-sm">
                          {t.name}
                          {t.english_name && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({t.english_name})
                            </span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              {others.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">其他</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                    {others.map((t) => (
                      <label key={t.id} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(t.id)}
                          onChange={() => toggleId(t.id)}
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

          <div className="flex items-center gap-2 pt-1 border-t">
            <button
              onClick={handleSave}
              disabled={saving || !loaded}
              className="h-7 px-3 text-xs rounded-md bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-50 transition-colors"
            >
              {saving ? '儲存中…' : '儲存'}
            </button>
            <button
              onClick={() => setShowSettings(false)}
              className="h-7 px-3 text-xs rounded-md border border-input hover:bg-muted transition-colors"
            >
              取消
            </button>
            {selectedIds.length > 0 && (
              <span className="text-xs text-muted-foreground ml-1">
                已選 {selectedIds.length} 位
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
