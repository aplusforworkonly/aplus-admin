'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { createAdminTask, updateTask } from '@/actions/admin-tasks';
import type { TaskType, TaskPriority, TaskSize, AdminTask } from '@/lib/supabase/types';

const CAMPUSES = ['文府總校', '龍華校', '左新校'];

interface Props {
  teachers: { id: string; name: string }[];
  parentId?: string;
  defaultType?: TaskType;
  editTask?: AdminTask;
  onClose: () => void;
}

export function TaskDialog({ teachers, parentId, defaultType = 'adhoc', editTask, onClose }: Props) {
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(editTask?.title ?? '');
  const [description, setDescription] = useState(editTask?.description ?? '');
  const [taskType, setTaskType] = useState<TaskType>(editTask?.task_type ?? defaultType);
  const [priority, setPriority] = useState<TaskPriority>(editTask?.priority ?? 'normal');
  const [size, setSize] = useState<TaskSize>(editTask?.size ?? 'S');
  const [campus, setCampus] = useState<string>(editTask?.campus?.[0] ?? '');
  const [assignedTo, setAssignedTo] = useState(editTask?.assigned_to ?? '');
  const [dueDate, setDueDate] = useState(editTask?.due_date ?? '');
  const [error, setError] = useState('');

  function handleSubmit() {
    if (!title.trim()) { setError('請填寫任務標題'); return; }
    setError('');

    startTransition(async () => {
      try {
        if (editTask) {
          await updateTask(editTask.id, {
            title: title.trim(),
            description: description || null,
            assignedTo: assignedTo || null,
            campus: campus ? [campus] : null,
            priority,
            size,
            dueDate: dueDate || null,
          });
        } else {
          await createAdminTask({
            title: title.trim(),
            description: description || undefined,
            taskType,
            taskSource: 'manual',
            parentId: parentId,
            campus: campus ? [campus] : undefined,
            priority,
            size,
            dueDate: dueDate || undefined,
            assignedTo: assignedTo || undefined,
          });
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
          {editTask ? '編輯任務' : parentId ? '新增子任務' : '新增任務'}
        </h2>

        <div className="space-y-1">
          <Label htmlFor="task-title">任務標題 *</Label>
          <Input
            id="task-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="簡短描述任務內容"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="task-desc">補充說明</Label>
          <Input
            id="task-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="（可選）"
          />
        </div>

        {!editTask && !parentId && (
          <div className="space-y-1">
            <Label>任務類型</Label>
            <Select value={taskType} onValueChange={(v) => setTaskType((v ?? 'adhoc') as TaskType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="project">專案任務（可拆子任務）</SelectItem>
                <SelectItem value="adhoc">突發任務</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
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
          <div className="space-y-1">
            <Label>任務量能</Label>
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
            <Label htmlFor="task-due">截止日期</Label>
            <Input
              id="task-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
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

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={pending}>取消</Button>
          <Button onClick={handleSubmit} disabled={pending}>
            {pending ? '處理中…' : editTask ? '儲存' : '建立'}
          </Button>
        </div>
      </div>
    </div>
  );
}
