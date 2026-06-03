'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createRoutingRule, updateRoutingRule } from '@/actions/task-routing-rules';
import type { TaskSource } from '@/lib/supabase/types';

const CAMPUSES = ['文府總校', '龍華校', '左新校'];
const GRADE_OPTIONS = [
  { label: '大班升小一', value: 0 },
  { label: '小一', value: 1 }, { label: '小二', value: 2 },
  { label: '小三', value: 3 }, { label: '小四', value: 4 },
  { label: '小五', value: 5 }, { label: '小六', value: 6 },
];
const SOURCE_OPTIONS: { label: string; value: TaskSource }[] = [
  { label: '請假申請', value: 'leave_request' },
  { label: '課程異動申請', value: 'student_request' },
  { label: '資料審核申請', value: 'student_review' },
];

interface RuleData {
  id: string;
  campus: string | null;
  task_source: TaskSource | null;
  grade_from: number | null;
  grade_to: number | null;
  assigned_to: string;
  priority: number;
}

interface Props {
  teachers: { id: string; name: string; campus: string | null }[];
  editRule?: RuleData;
  onClose: () => void;
}

export function RoutingRuleForm({ teachers, editRule, onClose }: Props) {
  const [pending, startTransition] = useTransition();
  const [campus, setCampus] = useState(editRule?.campus ?? '');
  const [taskSource, setTaskSource] = useState(editRule?.task_source ?? '');
  const [gradeFrom, setGradeFrom] = useState(editRule?.grade_from != null ? String(editRule.grade_from) : '');
  const [gradeTo, setGradeTo] = useState(editRule?.grade_to != null ? String(editRule.grade_to) : '');
  const [assignedTo, setAssignedTo] = useState(editRule?.assigned_to ?? '');
  const [priority, setPriority] = useState(String(editRule?.priority ?? 0));
  const [error, setError] = useState('');

  function handleSubmit() {
    if (!assignedTo) { setError('請選擇負責人'); return; }
    setError('');

    const input = {
      campus: campus || null,
      taskSource: (taskSource as TaskSource) || null,
      gradeFrom: gradeFrom !== '' ? Number(gradeFrom) : null,
      gradeTo: gradeTo !== '' ? Number(gradeTo) : null,
      assignedTo,
      priority: Number(priority) || 0,
    };

    startTransition(async () => {
      try {
        if (editRule) {
          await updateRoutingRule(editRule.id, input);
        } else {
          await createRoutingRule(input);
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
        <h2 className="text-lg font-semibold">{editRule ? '編輯指派規則' : '新增指派規則'}</h2>
        <p className="text-xs text-muted-foreground">空白欄位 = 全部適用（萬用規則）</p>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>校區</Label>
            <Select value={campus} onValueChange={(v) => setCampus(v ?? '')}>
              <SelectTrigger><SelectValue placeholder="全部校區" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部校區</SelectItem>
                {CAMPUSES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>任務類型</Label>
            <Select value={taskSource} onValueChange={(v) => setTaskSource(v ?? '')}>
              <SelectTrigger><SelectValue placeholder="全部類型" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部類型</SelectItem>
                {SOURCE_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>年級起（含）</Label>
            <Select value={gradeFrom} onValueChange={(v) => setGradeFrom(v ?? '')}>
              <SelectTrigger><SelectValue placeholder="不限" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">不限</SelectItem>
                {GRADE_OPTIONS.map((g) => (
                  <SelectItem key={g.value} value={String(g.value)}>{g.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>年級迄（含）</Label>
            <Select value={gradeTo} onValueChange={(v) => setGradeTo(v ?? '')}>
              <SelectTrigger><SelectValue placeholder="不限" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">不限</SelectItem>
                {GRADE_OPTIONS.map((g) => (
                  <SelectItem key={g.value} value={String(g.value)}>{g.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1">
          <Label>負責人 *</Label>
          <Select value={assignedTo} onValueChange={(v) => setAssignedTo(v ?? '')}>
            <SelectTrigger><SelectValue placeholder="選擇學務老師" /></SelectTrigger>
            <SelectContent>
              {teachers.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}{t.campus ? ` · ${t.campus}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="priority">優先級（數字越大越優先）</Label>
          <Input
            id="priority"
            type="number"
            min="0"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={pending}>取消</Button>
          <Button onClick={handleSubmit} disabled={pending}>
            {pending ? '處理中…' : editRule ? '儲存' : '建立規則'}
          </Button>
        </div>
      </div>
    </div>
  );
}
