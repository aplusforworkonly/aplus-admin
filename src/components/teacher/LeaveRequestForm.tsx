'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { submitLeaveRequest } from '@/actions/leave-requests';

type Student = { id: string; name: string };
type Course = { id: string; name: string };

const LEAVE_TYPES = ['病假', '事假', '喪假', '活動日', '其他'];

export default function LeaveRequestForm({
  teacherId,
  students,
}: {
  teacherId: string;
  students: Student[];
}) {
  const [type, setType] = useState<'請假' | '退班'>('請假');
  const [studentId, setStudentId] = useState('');
  const [leaveDate, setLeaveDate] = useState('');
  const [leaveDateEnd, setLeaveDateEnd] = useState('');
  const [leaveType, setLeaveType] = useState('病假');
  const [reason, setReason] = useState('');
  const [courseId, setCourseId] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [note, setNote] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  async function loadCourses(sid: string) {
    setStudentId(sid);
    if (type === '退班' && sid) {
      const res = await fetch(`/api/student-courses?studentId=${sid}`);
      const data = await res.json();
      setCourses(data);
    }
  }

  function handleStartDateChange(val: string) {
    setLeaveDate(val);
    if (leaveDateEnd && leaveDateEnd < val) setLeaveDateEnd(val);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess(false);
    startTransition(async () => {
      try {
        await submitLeaveRequest({
          teacherId,
          studentId,
          requestType: type,
          leaveDate: type === '請假' ? leaveDate : undefined,
          leaveDateEnd: type === '請假' ? (leaveDateEnd || leaveDate) : undefined,
          leaveType: type === '請假' ? leaveType : undefined,
          courseId: type === '退班' ? courseId : undefined,
          reason: type === '請假' ? reason : undefined,
          note,
        });
        setSuccess(true);
        setStudentId('');
        setLeaveDate('');
        setLeaveDateEnd('');
        setReason('');
        setNote('');
        setCourseId('');
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : '送出失敗');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      {/* 申請類型 */}
      <div className="flex gap-2">
        {(['請假', '退班'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => { setType(t); setCourseId(''); }}
            className={[
              'h-9 px-4 rounded-md border text-sm font-medium transition-colors',
              type === t ? 'bg-primary text-primary-foreground border-primary' : 'border-input bg-background hover:bg-accent',
            ].join(' ')}
          >
            {t}
          </button>
        ))}
      </div>

      {/* 選學生 */}
      <div className="space-y-1">
        <p className="text-sm font-medium">學生</p>
        <select
          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={studentId}
          onChange={(e) => loadCourses(e.target.value)}
          required
        >
          <option value="">— 選擇學生 —</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* 請假欄位 */}
      {type === '請假' && (
        <>
          <div className="space-y-1">
            <p className="text-sm font-medium">請假日期</p>
            <div className="flex items-center gap-2">
              <Input type="date" value={leaveDate} onChange={(e) => handleStartDateChange(e.target.value)} className="w-40" required />
              <span className="text-sm text-muted-foreground">至</span>
              <Input type="date" value={leaveDateEnd || leaveDate} min={leaveDate} onChange={(e) => setLeaveDateEnd(e.target.value)} className="w-40" />
            </div>
            <p className="text-xs text-muted-foreground">單日請假只填左側；連假請填起訖。</p>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">假別</p>
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value)}
            >
              {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">請假原因 <span className="text-destructive">*</span></p>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="例：發燒、家庭因素"
              required
            />
          </div>
        </>
      )}

      {/* 退班欄位 */}
      {type === '退班' && courses.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-medium">退班課程</p>
          <select
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            required
          >
            <option value="">— 選擇課程 —</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      <div className="space-y-1">
        <p className="text-sm font-medium">備註（選填）</p>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="補充說明" />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-green-700">已送出，等待行政確認。</p>}

      <Button type="submit" disabled={pending}>
        {pending ? '送出中...' : '送出申請'}
      </Button>
    </form>
  );
}
