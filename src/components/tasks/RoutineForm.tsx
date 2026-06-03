'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { createRoutineDefinition, updateRoutineDefinition } from '@/actions/routine-definitions';
import type { FrequencyType, TaskPriority, TaskSize, RoutineDefinition } from '@/lib/supabase/types';

const CAMPUSES = ['文府總校', '龍華校', '左新校'];
const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

interface Props {
  teachers: { id: string; name: string }[];
  editDef?: RoutineDefinition;
  onClose: () => void;
}

export function RoutineForm({ teachers, editDef, onClose }: Props) {
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(editDef?.title ?? '');
  const [description, setDescription] = useState(editDef?.description ?? '');
  const [freqType, setFreqType] = useState<FrequencyType>(editDef?.frequency_type ?? 'weekly');
  const [freqValue, setFreqValue] = useState<string>(
    editDef?.frequency_value != null ? String(editDef.frequency_value) : ''
  );
  const [advanceDays, setAdvanceDays] = useState(String(editDef?.advance_days ?? 0));
  const [campus, setCampus] = useState<string>(editDef?.campus?.[0] ?? '');
  const [assignedTo, setAssignedTo] = useState(editDef?.assigned_to ?? '');
  const [size, setSize] = useState<TaskSize>(editDef?.size ?? 'S');
  const [priority, setPriority] = useState<TaskPriority>(editDef?.priority ?? 'normal');
  const [error, setError] = useState('');

  function handleSubmit() {
    if (!title.trim()) { setError('請填寫任務標題'); return; }
    if (freqType !== 'daily' && !freqValue) { setError('請選擇頻率數值'); return; }
    setError('');

    const input = {
      title: title.trim(),
      description: description || undefined,
      frequencyType: freqType,
      frequencyValue: freqValue ? Number(freqValue) : undefined,
      advanceDays: Number(advanceDays) || 0,
      campus: campus ? [campus] : undefined,
      assignedTo: assignedTo || undefined,
      size,
      priority,
    };

    startTransition(async () => {
      try {
        if (editDef) {
          await updateRoutineDefinition(editDef.id, {
            ...input,
            campus: campus ? [campus] : null,
            assignedTo: assignedTo || null,
          });
        } else {
          await createRoutineDefinition(input);
        }
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : '操作失敗');
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-background rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
        <h2 className="text-lg font-semibold">
          {editDef ? '編輯例行任務範本' : '新增例行任務範本'}
        </h2>

        <div className="space-y-1">
          <Label htmlFor="routine-title">任務名稱 *</Label>
          <Input
            id="routine-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例：月費提醒電話"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="routine-desc">補充說明</Label>
          <Input
            id="routine-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="（可選）"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>執行頻率</Label>
            <Select value={freqType} onValueChange={(v) => { setFreqType((v ?? 'weekly') as FrequencyType); setFreqValue(''); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">每天</SelectItem>
                <SelectItem value="weekly">每週</SelectItem>
                <SelectItem value="monthly">每月</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {freqType === 'weekly' && (
            <div className="space-y-1">
              <Label>星期幾</Label>
              <Select value={freqValue} onValueChange={(v) => setFreqValue(v ?? '')}>
                <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((d, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>星期{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {freqType === 'monthly' && (
            <div className="space-y-1">
              <Label>每月幾號</Label>
              <Select value={freqValue} onValueChange={(v) => setFreqValue(v ?? '')}>
                <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 28 }, (_, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{i + 1} 號</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="advance">提前幾天產生任務</Label>
          <Input
            id="advance"
            type="number"
            min="0"
            max="14"
            value={advanceDays}
            onChange={(e) => setAdvanceDays(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">0 = 當天產生、1 = 前一天產生</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>校區</Label>
            <Select value={campus} onValueChange={(v) => setCampus(v ?? '')}>
              <SelectTrigger><SelectValue placeholder="選擇校區" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">不指定</SelectItem>
                {CAMPUSES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>量能</Label>
            <Select value={size} onValueChange={(v) => setSize((v ?? 'S') as TaskSize)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="S">S（0.5–1h）</SelectItem>
                <SelectItem value="M">M（2–4h）</SelectItem>
                <SelectItem value="L">L（1天+）</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1">
          <Label>負責人</Label>
          <Select value={assignedTo} onValueChange={(v) => setAssignedTo(v ?? '')}>
            <SelectTrigger><SelectValue placeholder="選擇負責人" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">不指定</SelectItem>
              {teachers.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>優先級</Label>
          <Select value={priority} onValueChange={(v) => setPriority((v ?? 'normal') as TaskPriority)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="urgent">🔴 緊急</SelectItem>
              <SelectItem value="normal">⚪ 一般</SelectItem>
              <SelectItem value="low">🔵 低優先</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={pending}>取消</Button>
          <Button onClick={handleSubmit} disabled={pending}>
            {pending ? '處理中…' : editDef ? '儲存' : '建立範本'}
          </Button>
        </div>
      </div>
    </div>
  );
}
