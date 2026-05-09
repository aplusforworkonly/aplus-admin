'use client';
import { useState, useTransition, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { submitLeaveRequest } from '@/actions/leave-requests';
import { submitCancelRequest, getStudentEnrollments, type StudentEnrollment } from '@/actions/cancel-requests';
import { uploadMedicalProof } from '@/actions/upload';

type Student = { id: string; name: string; english_name?: string | null };
type Course = { id: string; name: string };

const LEAVE_TYPES = ['病假', '事假', '喪假', '其他'];
const DISEASE_TYPES = ['腸病毒', '流感', '水痘', '麻疹', '病毒性腸胃炎', '登革熱', '以上皆非'];

interface TeacherLeaveFormProps {
  teacherId: string;
  students: Student[];
  courses: Course[];
  defaultTab?: 'leave' | 'course';
}

export default function TeacherLeaveForm({
  teacherId,
  students,
  courses,
  defaultTab = 'leave',
}: TeacherLeaveFormProps) {
  const [requestType, setRequestType] = useState<'leave' | 'course'>(defaultTab);
  
  useEffect(() => {
    setRequestType(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    const handleTabChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      setRequestType(customEvent.detail);
    };
    window.addEventListener('teacherTabChange', handleTabChange);
    return () => window.removeEventListener('teacherTabChange', handleTabChange);
  }, []);

  const [courseAction, setCourseAction] = useState<'cancel' | 'add'>('cancel');

  // 共用
  const [studentId, setStudentId] = useState('');
  const [reason, setReason] = useState('');

  // 請假專用
  const [leaveDate, setLeaveDate] = useState('');
  const [leaveDateEnd, setLeaveDateEnd] = useState('');
  const [leaveTimeStart, setLeaveTimeStart] = useState('08:30');
  const [leaveTimeEnd, setLeaveTimeEnd] = useState('16:30');
  const [leaveType, setLeaveType] = useState('病假');
  const [note, setNote] = useState('');
  const [diseaseType, setDiseaseType] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);

  // 課程異動專用
  const [courseId, setCourseId] = useState('');
  const [studentEnrollments, setStudentEnrollments] = useState<StudentEnrollment[]>([]);
  const [enrollmentLoading, startEnrollmentTransition] = useTransition();

  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function handleStudentChange(val: string) {
    setStudentId(val);
    setCourseId('');
    setStudentEnrollments([]);
    if (val && requestType === 'course') {
      startEnrollmentTransition(async () => {
        const result = await getStudentEnrollments(val);
        setStudentEnrollments(result);
      });
    }
  }

  function handleStartDateChange(val: string) {
    setLeaveDate(val);
    if (leaveDateEnd && leaveDateEnd < val) setLeaveDateEnd(val);
  }

  function resetForm() {
    setStudentId('');
    setReason('');
    setLeaveDate('');
    setLeaveDateEnd('');
    setNote('');
    setDiseaseType('');
    setProofFile(null);
    setCourseId('');
    setStudentEnrollments([]);
  }

  function handleTabChange(tab: 'leave' | 'course') {
    setRequestType(tab);
    setSuccess(false);
    setError('');
    resetForm();
    window.history.pushState(null, '', `/teacher?tab=${tab}`);
    window.dispatchEvent(new CustomEvent('teacherTabChange', { detail: tab }));
  }

  function handleCourseActionChange(action: 'cancel' | 'add') {
    setCourseAction(action);
    setSuccess(false);
    setError('');
    setCourseId('');
    // 如果學生已選，重新載入對應清單
    if (studentId) {
      startEnrollmentTransition(async () => {
        const result = await getStudentEnrollments(studentId);
        setStudentEnrollments(result);
      });
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess(false);
    startTransition(async () => {
      try {
        if (requestType === 'leave') {
          let proofFileUrl: string | undefined;
          if ((leaveType === '病假' && proofFile && diseaseType && diseaseType !== '以上皆非') || (leaveType === '喪假' && proofFile)) {
            const fd = new FormData();
            fd.append('file', proofFile);
            fd.append('studentId', studentId);
            proofFileUrl = await uploadMedicalProof(fd);
          }
          const finalNote = `[時間: ${leaveTimeStart}-${leaveTimeEnd}] ${note}`.trim();
          await submitLeaveRequest({
            teacherId,
            studentId,
            requestType: '請假',
            leaveDate,
            leaveDateEnd: leaveDateEnd || leaveDate,
            leaveType,
            reason,
            note: finalNote,
            diseaseType: diseaseType || undefined,
            proofFileUrl,
          });
        } else {
          await submitCancelRequest({ teacherId, studentId, courseId, reason, requestType: courseAction });
        }
        setSuccess(true);
        resetForm();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : '送出失敗，請再試一次。');
      }
    });
  }

  if (students.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        目前沒有設定您為總導師的學生，請聯繫行政人員。
      </p>
    );
  }

  const selectCls = 'w-full h-12 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm focus:ring-2 focus:ring-teal-600 focus:outline-none transition-shadow';
  const inputCls = 'w-full h-12 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm focus:ring-2 focus:ring-teal-600 focus:outline-none transition-shadow';

  // 加報時排除已有生效合約的課程
  const enrolledCourseIds = new Set(studentEnrollments.map((e) => e.courseId));
  const availableCourses = courseAction === 'add'
    ? courses.filter((c) => !enrolledCourseIds.has(c.id))
    : [];

  const successMessage = requestType === 'leave'
    ? '✓ 請假通報已送出，等待行政確認後生效。如需再通報請重新填寫。'
    : courseAction === 'cancel'
      ? '✓ 取消課程申請已送出，行政確認後將自動更新合約狀態。'
      : '✓ 加報課程申請已送出，行政確認後將建立候補合約。';

  const needsProof = requestType === 'leave' && (
    (leaveType === '病假' && !!diseaseType && diseaseType !== '以上皆非') ||
    (leaveType === '喪假')
  );
  const isSubmittable = requestType === 'leave'
    ? !!studentId && !!reason && !!leaveDate && (!needsProof || !!proofFile)
    : !!studentId && !!courseId && !!reason;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 主 Tab - Translated from Stitch Toggle Switch */}
      <div className="flex w-full mb-8 rounded-lg overflow-hidden border border-slate-200 shadow-sm">
        <button
          type="button"
          onClick={() => handleTabChange('leave')}
          className={`flex-1 py-3 transition-all ${requestType === 'leave' ? 'bg-teal-900 text-teal-50 font-bold' : 'bg-white text-slate-500 hover:bg-slate-50 font-medium'}`}
        >
          請假通報
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('course')}
          className={`flex-1 py-3 transition-all border-l border-slate-200 ${requestType === 'course' ? 'bg-teal-900 text-teal-50 font-bold' : 'bg-white text-slate-500 hover:bg-slate-50 font-medium'}`}
        >
          課程異動
        </button>
      </div>

      {/* 課程異動子選項 */}
      {requestType === 'course' && (
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm shadow-sm">
          <button
            type="button"
            onClick={() => handleCourseActionChange('cancel')}
            className={`flex-1 py-2.5 transition-colors ${courseAction === 'cancel' ? 'bg-slate-100 text-slate-900 font-semibold' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
          >
            取消課程
          </button>
          <button
            type="button"
            onClick={() => handleCourseActionChange('add')}
            className={`flex-1 py-2.5 transition-colors border-l border-slate-200 ${courseAction === 'add' ? 'bg-slate-100 text-slate-900 font-semibold' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
          >
            加報課程
          </button>
        </div>
      )}

      {/* 學生 */}
      <div className="space-y-1">
        <p className="text-sm font-medium">學生</p>
        <select
          className={selectCls}
          value={studentId}
          onChange={(e) => handleStudentChange(e.target.value)}
          required
        >
          <option value="">— 請選擇學生 —</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>{s.name}{s.english_name ? ` (${s.english_name})` : ''}</option>
          ))}
        </select>
      </div>

      {/* 課程異動：課程選擇 */}
      {requestType === 'course' && (
        <div className="space-y-1">
          <p className="text-sm font-medium">
            {courseAction === 'cancel' ? '取消哪個課程合約' : '加報哪個課程'}
            <span className="text-destructive"> *</span>
          </p>
          {enrollmentLoading ? (
            <p className="text-sm text-muted-foreground py-2">載入中...</p>
          ) : courseAction === 'cancel' ? (
            <select
              className={selectCls}
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              disabled={!studentId}
              required
            >
              <option value="">
                {!studentId ? '請先選擇學生' : studentEnrollments.length === 0 ? '該學生目前無生效合約' : '— 請選擇要取消的課程 —'}
              </option>
              {studentEnrollments.map((e) => (
                <option key={e.courseId} value={e.courseId}>{e.courseName}</option>
              ))}
            </select>
          ) : (
            <select
              className={selectCls}
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              disabled={!studentId}
              required
            >
              <option value="">
                {!studentId ? '請先選擇學生' : availableCourses.length === 0 ? '無可加報課程' : '— 請選擇要加報的課程 —'}
              </option>
              {availableCourses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* 請假專屬欄位 */}
      {requestType === 'leave' && (
        <>
          <div className="space-y-2">
            <p className="text-sm font-medium">請假日期與時間</p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <input
                type="date"
                value={leaveDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className={inputCls + ' sm:w-48'}
                required
              />
              <span className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-md self-center">至</span>
              <input
                type="date"
                value={leaveDateEnd || leaveDate}
                min={leaveDate}
                onChange={(e) => setLeaveDateEnd(e.target.value)}
                className={inputCls + ' sm:w-48'}
              />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-2">
              <input
                type="time"
                value={leaveTimeStart}
                onChange={(e) => setLeaveTimeStart(e.target.value)}
                min="08:30"
                max="16:30"
                className={inputCls + ' sm:w-48'}
                required
              />
              <span className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-md self-center">至</span>
              <input
                type="time"
                value={leaveTimeEnd}
                onChange={(e) => setLeaveTimeEnd(e.target.value)}
                min="08:30"
                max="16:30"
                className={inputCls + ' sm:w-48'}
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">時間區間限定為 08:30 - 16:30。</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">假別</p>
            <select className={selectCls} value={leaveType} onChange={(e) => { setLeaveType(e.target.value); setDiseaseType(''); setProofFile(null); }}>
              {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {leaveType === '病假' && (
            <div className="space-y-1">
              <p className="text-sm font-medium">疾病類型 <span className="text-destructive">*</span></p>
              <select className={selectCls} value={diseaseType} onChange={(e) => { setDiseaseType(e.target.value); setProofFile(null); }}>
                <option value="">— 請選擇 —</option>
                {DISEASE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}
          {needsProof && (
            <div className="rounded-lg bg-muted/60 border border-muted-foreground/20 px-4 py-3 space-y-2">
              <p className="text-sm font-medium">
                {leaveType === '喪假' ? '喪假證明上傳' : '醫療證明上傳'}
                <span className="text-destructive"> *</span>
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {leaveType === '喪假' ? '喪假需附證明文件（如訃聞）才可送出' : '法定傳染病需附證明才可送出'}
                </span>
              </p>
              <label className="flex flex-col items-center justify-center w-full h-24 rounded-md border-2 border-dashed border-muted-foreground/30 bg-background cursor-pointer hover:bg-muted/40 transition-colors">
                <span className="text-sm text-muted-foreground">
                  {proofFile ? proofFile.name : '點擊選擇圖片或 PDF'}
                </span>
                {proofFile && <span className="text-xs text-green-600 mt-1">已選擇，點擊可更換</span>}
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {!proofFile && <p className="text-xs text-destructive">尚未上傳，無法送出</p>}
            </div>
          )}
          <div className="space-y-2">
            <p className="text-sm font-medium">請假原因 <span className="text-destructive">*</span></p>
            <input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="例：發燒、家庭因素" required />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">補充說明（選填）</p>
            <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="其他補充資訊" />
          </div>
        </>
      )}

      {/* 課程異動原因 */}
      {requestType === 'course' && (
        <div className="space-y-1">
          <p className="text-sm font-medium">
            {courseAction === 'cancel' ? '取消原因' : '加報原因'}
            <span className="text-destructive"> *</span>
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={courseAction === 'cancel' ? '請說明取消課程原因（如：搬家、時間衝突）' : '請說明加報課程原因（如：補修、新增興趣班）'}
            required
            rows={3}
            className="w-full h-auto rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm resize-none focus:ring-2 focus:ring-teal-600 focus:outline-none transition-shadow"
          />
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {success ? (
        <div className="rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-800">
          {successMessage}
        </div>
      ) : (
        <Button type="submit" disabled={pending || !isSubmittable} className="w-full h-12 text-base font-bold shadow-md hover:bg-teal-800 bg-teal-900 text-teal-50 active:scale-[0.98] transition-all mt-4">
          {pending ? '送出中...' : requestType === 'leave' ? '送出請假通報' : courseAction === 'cancel' ? '送出取消課程申請' : '送出加報課程申請'}
        </Button>
      )}
    </form>
  );
}
