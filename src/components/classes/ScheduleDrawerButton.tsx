'use client';
import { useState, useEffect, useCallback, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { getClassSchedules } from '@/actions/schedules';
import { updateClassInfo } from '@/actions/classes';
import { ClassScheduleManager } from './ClassScheduleManager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ClassSchedule } from '@/lib/supabase/types';

export default function ScheduleDrawerButton({
  classId,
  name,
  location = null,
  isOptimistic = false,
}: {
  classId: string;
  name: string;
  location?: string | null;
  isOptimistic?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [schedules, setSchedules] = useState<ClassSchedule[]>([]);

  const [locationVal, setLocationVal] = useState(location ?? '');
  const [locationSaved, setLocationSaved] = useState(false);
  const [locationPending, startLocationTransition] = useTransition();
  const locationDirty = locationVal !== (location ?? '');

  // 防護：樂觀暫存行不渲染按鈕
  if (isOptimistic) return null;

  const refresh = useCallback(async () => {
    const data = await getClassSchedules(classId);
    setSchedules(data);
  }, [classId]);

  async function handleOpen() {
    setOpen(true);
    setLoading(true);
    await refresh();
    setLoading(false);
  }

  function close() {
    setOpen(false);
  }

  // 每次 Drawer 開啟，強制同步 location prop，避免切換班級時殘留舊值
  useEffect(() => {
    if (open) setLocationVal(location ?? '');
  }, [open]);

  // Esc 關閉，嚴格清理避免殭屍監聽器
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  function handleSaveLocation() {
    startLocationTransition(async () => {
      await updateClassInfo(classId, { location: locationVal.trim() || null });
      setLocationSaved(true);
      setTimeout(() => setLocationSaved(false), 2000);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="text-xs text-blue-600 hover:text-blue-800 shrink-0 px-1"
      >
        編輯班級資訊
      </button>

      {open && createPortal(
        <>
          {/* 背景遮罩 */}
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={close}
          />

          {/* 右側面板 */}
          <div className="fixed top-0 right-0 z-50 h-full w-[420px] max-w-full bg-background shadow-xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b px-5 py-4 shrink-0">
              <h2 className="font-semibold text-sm">{name}・班級資訊</h2>
              <button
                type="button"
                onClick={close}
                className="text-muted-foreground hover:text-foreground text-lg leading-none"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {/* 教室位置 */}
              <div className="pb-4 mb-4 border-b space-y-2">
                <p className="text-xs font-medium text-muted-foreground">教室位置</p>
                <div className="flex items-center gap-2">
                  <Input
                    value={locationVal}
                    onChange={(e) => {
                      const sanitized = e.target.value.replace(/[^0-9a-zA-Z]/g, '').toUpperCase();
                      setLocationVal(sanitized);
                      setLocationSaved(false);
                    }}
                    placeholder="例：1A、203B"
                    className="h-8 text-sm w-28"
                    disabled={locationPending}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    disabled={!locationDirty || locationPending}
                    onClick={handleSaveLocation}
                  >
                    {locationPending ? '儲存中...' : '儲存'}
                  </Button>
                  {locationSaved && <span className="text-xs text-green-600 shrink-0">✓</span>}
                </div>
                <p className="text-xs text-muted-foreground">格式：樓層 + 代號，如 1A、2B</p>
              </div>

              {/* 課程時段 */}
              <p className="text-xs font-medium text-muted-foreground mb-3">課程時段</p>
              {loading ? (
                <p className="text-sm text-muted-foreground">載入中…</p>
              ) : (
                <ClassScheduleManager
                  classId={classId}
                  schedules={schedules}
                  onMutate={refresh}
                />
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
