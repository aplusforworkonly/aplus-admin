'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateStudent, createStudent, deactivateStudent, checkStudentConflict, createStudentAndParent, type ConflictResult, type StudentPayload } from '@/actions/students';
import { unlinkParentFromStudent } from '@/actions/parents';
import DuplicateConflictDialog from '@/components/students/DuplicateConflictDialog';
import LinkParentDialog from '@/components/students/LinkParentDialog';
import { getGrade } from '@/lib/grade';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { StudentWithParents, StudentStatus, CampusType, ProgramType } from '@/lib/supabase/types';

type TeacherOption = { id: string; name: string; english_name: string | null; department: string | null };

// 學制 → 可選導師的部門值（對應 teachers.department）
const TUTOR_DEPT: Record<string, string> = {
  '全日班': '教學部',
  '單上英語': '英語部',
};

const GRADE_OPTIONS = [
  { label: '大班升小一', value: 0 },
  { label: '小一', value: 1 },
  { label: '小二', value: 2 },
  { label: '小三', value: 3 },
  { label: '小四', value: 4 },
  { label: '小五', value: 5 },
  { label: '小六', value: 6 },
];

function currentTWAcademicYear(): number {
  const now = new Date();
  return now.getFullYear() - 1911 - (now.getMonth() < 8 ? 1 : 0);
}

interface Props {
  student?: StudentWithParents;
  teachers?: TeacherOption[];
}

const defaultForm = {
  name: '',
  english_name: '',
  birth_date: '',
  id_number: '',
  enrollment_date: new Date().toISOString().split('T')[0],
  status: '就讀中' as StudentStatus,
  campus: null as CampusType | null,
  is_school_student: false,
  program_type: null as ProgramType | null,
  main_tutor_id: null as string | null,
};

export default function StudentForm({ student, teachers = [] }: Props) {
  const router = useRouter();
  const isNew = !student;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [parentActionLoading, setParentActionLoading] = useState(false);
  const [pendingConflict, setPendingConflict] = useState<{
    result: Extract<ConflictResult, { status: 'conflict' }>;
    payload: StudentPayload;
  } | null>(null);
  const [form, setForm] = useState({
    name: student?.name ?? defaultForm.name,
    english_name: student?.english_name ?? defaultForm.english_name,
    birth_date: student?.birth_date ?? defaultForm.birth_date,
    id_number: student?.id_number ?? defaultForm.id_number,
    enrollment_date: student?.enrollment_date ?? defaultForm.enrollment_date,
    status: student?.status ?? defaultForm.status,
    campus: student?.campus ?? defaultForm.campus,
    is_school_student: student?.is_school_student ?? defaultForm.is_school_student,
    program_type: student?.program_type ?? defaultForm.program_type,
    main_tutor_id: student?.main_tutor_id ?? defaultForm.main_tutor_id,
  });

  function handleGradeChange(gradeLabel: string | null) {
    if (!gradeLabel) return;
    const option = GRADE_OPTIONS.find((g) => g.label === gradeLabel);
    if (!option) return;
    const current = new Date(form.enrollment_date);
    const monthIdx = current.getMonth(); // 0-indexed
    // getGrade subtracts 1 from TW year when month < 8 (Jan–Aug); inverse must add it back
    const newYear = currentTWAcademicYear() - option.value + 1 + 1911 + (monthIdx < 8 ? 1 : 0);
    const month = String(monthIdx + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');
    setForm((p) => ({ ...p, enrollment_date: `${newYear}-${month}-${day}` }));
  }

  const visibleTutors = teachers.filter((t) => {
    const requiredDept = form.program_type ? TUTOR_DEPT[form.program_type] : null;
    if (!requiredDept) return true;
    return t.department === requiredDept;
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = {
        name: form.name,
        english_name: form.english_name || null,
        birth_date: form.birth_date || null,
        id_number: form.id_number || null,
        enrollment_date: form.enrollment_date,
        status: form.status,
        campus: form.campus,
        is_school_student: form.is_school_student,
        program_type: form.program_type,
        main_tutor_id: form.main_tutor_id,
      };
      if (isNew) {
        if (parentPhone.trim()) {
          const result = await checkStudentConflict(form.name, parentPhone.trim());
          if (result.status === 'exists') {
            setError('此家長電話已綁定相同姓名的學生，請至學生列表確認是否已建檔。');
            setLoading(false);
            return;
          }
          if (result.status === 'conflict') {
            setPendingConflict({ result, payload });
            setLoading(false);
            return;
          }
          // 'clear' + 有電話 → 順手建立家長 stub 並綁定
          const id = await createStudentAndParent(payload, parentPhone.trim());
          router.push(`/students/${id}`);
          return;
        }
        await createStudent(payload);
      } else {
        await updateStudent(student.id, payload);
      }
      router.push('/students');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '儲存失敗');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeactivate() {
    if (!student) return;
    if (!confirm(`確定停用 ${form.name}？此操作不可逆。`)) return;
    setLoading(true);
    try {
      await deactivateStudent(student.id);
      router.push('/students');
    } finally {
      setLoading(false);
    }
  }

  async function handleUnlink(mappingId: string) {
    if (!student) return;
    if (!confirm('確定解除此家長關聯？家長的基本資料不會被刪除。')) return;
    setParentActionLoading(true);
    try {
      await unlinkParentFromStudent(mappingId, student.id);
      router.refresh();
    } finally {
      setParentActionLoading(false);
    }
  }

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>基本資料</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="name">姓名 *</Label>
              <Input id="name" value={form.name} onChange={set('name')} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="english_name">英文名字</Label>
              <Input id="english_name" value={form.english_name} onChange={set('english_name')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="birth_date">生日</Label>
              <Input id="birth_date" type="date" value={form.birth_date} onChange={set('birth_date')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="id_number">身分證字號</Label>
              <Input
                id="id_number"
                value={form.id_number}
                onChange={set('id_number')}
                className="font-mono"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="enrollment_date">入學日期 *</Label>
              <Input
                id="enrollment_date"
                type="date"
                value={form.enrollment_date}
                onChange={set('enrollment_date')}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>年級</Label>
              <Select
                value={form.enrollment_date && form.status === '就讀中' ? getGrade(form.enrollment_date) : ''}
                onValueChange={handleGradeChange}
                disabled={form.status !== '就讀中'}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {GRADE_OPTIONS.map((g) => (
                    <SelectItem key={g.value} value={g.label}>{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>校內生</Label>
              <Select
                value={form.is_school_student ? 'yes' : 'no'}
                onValueChange={(v) => setForm((p) => ({ ...p, is_school_student: v === 'yes' }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no">否</SelectItem>
                  <SelectItem value="yes">是（享校內生折扣）</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>學制</Label>
              <Select
                value={form.program_type ?? ''}
                onValueChange={(v) => setForm((p) => ({
                  ...p,
                  program_type: (v || null) as ProgramType | null,
                  main_tutor_id: null,
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇學制" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="全日班">全日班</SelectItem>
                  <SelectItem value="單上英語">單上英語</SelectItem>
                  <SelectItem value="其他">其他</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>總導師</Label>
              <Select
                value={form.main_tutor_id ?? ''}
                onValueChange={(v) => setForm((p) => ({ ...p, main_tutor_id: v || null }))}
                disabled={visibleTutors.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={visibleTutors.length === 0 ? '請先選擇學制' : '選擇總導師'}>
                    {form.main_tutor_id ? (() => {
                      const t = teachers.find((t) => t.id === form.main_tutor_id);
                      return t ? (t.english_name ? `${t.english_name}（${t.name}）` : t.name) : null;
                    })() : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {visibleTutors.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.english_name ? `${t.english_name}（${t.name}）` : t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {isNew && (
            <div className="space-y-1">
              <Label htmlFor="parent_phone">家長手機（選填，用於防止重複建檔）</Label>
              <Input
                id="parent_phone"
                type="tel"
                placeholder="09XX-XXX-XXX"
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)}
                className="max-w-xs"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>校區</Label>
              <Select
                value={form.campus ?? ''}
                onValueChange={(v) => setForm((p) => ({ ...p, campus: (v || null) as CampusType | null }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇校區" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="文府總校">文府總校</SelectItem>
                  <SelectItem value="龍華校">龍華校</SelectItem>
                  <SelectItem value="左新校">左新校</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>狀態</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((p) => ({ ...p, status: v as StudentStatus }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="就讀中">就讀中</SelectItem>
                  <SelectItem value="已離校">已離校</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {!isNew && student.notes && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-amber-800">系統稽核紀錄</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs text-amber-900 whitespace-pre-wrap font-mono leading-relaxed">
              {student.notes}
            </pre>
          </CardContent>
        </Card>
      )}

      {!isNew && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">關聯家長</CardTitle>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => setShowLinkDialog(true)}
            >
              + 新增 / 綁定家長
            </Button>
          </CardHeader>
          <CardContent>
            {student.parent_student_mapping?.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {student.parent_student_mapping.map((m) => (
                  <li key={m.id} className="flex items-center gap-2">
                    <span className="text-muted-foreground w-4 shrink-0">{m.relationship}</span>
                    <span className="font-medium">{m.parents?.name}</span>
                    <span className="text-muted-foreground font-mono text-xs">
                      {m.parents?.phone}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs text-destructive hover:text-destructive ml-auto"
                      disabled={parentActionLoading}
                      onClick={() => handleUnlink(m.id)}
                    >
                      解除關聯
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">尚無關聯家長</p>
            )}
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? '儲存中...' : isNew ? '建立學生' : '儲存變更'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          取消
        </Button>
        {!isNew && form.status === '就讀中' && (
          <Button
            type="button"
            variant="destructive"
            disabled={loading}
            onClick={handleDeactivate}
            className="ml-auto"
          >
            停用學生
          </Button>
        )}
      </div>
    </form>

    {showLinkDialog && !isNew && (
      <LinkParentDialog
        studentId={student!.id}
        onClose={() => setShowLinkDialog(false)}
        onDone={() => { setShowLinkDialog(false); router.refresh(); }}
      />
    )}

    {pendingConflict && (
      <DuplicateConflictDialog
        newStudentName={form.name}
        parentPhone={pendingConflict.result.parentPhone}
        parentId={pendingConflict.result.parentId}
        existingStudents={pendingConflict.result.existingStudents}
        studentPayload={pendingConflict.payload}
        onClose={() => setPendingConflict(null)}
        onDone={(id) => router.push(`/students/${id}`)}
      />
    )}
    </>
  );
}
