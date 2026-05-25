'use client';
import { useState, useTransition, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { submitLeaveRequest } from '@/actions/leave-requests';
import { submitCancelRequest, getStudentEnrollments, type StudentEnrollment } from '@/actions/cancel-requests';
import { uploadMedicalProof } from '@/actions/upload';

type Student = { id: string; name: string; english_name?: string | null };
type Course = { id: string; name: string };

// slotKey 格式：多月份課程用 "${courseId}|${month}"，其他用 "${courseId}"
function parseSlotKey(slotKey: string): { courseId: string; month: number | null } {
  if (slotKey.includes('|')) {
    const [courseId, m] = slotKey.split('|');
    return { courseId, month: parseInt(m) };
  }
  return { courseId: slotKey, month: null };
}

const LEAVE_TYPES = ['病假', '事假', '喪假', '其他'];
const DISEASE_TYPES = ['腸病毒', '流感', '水痘', '麻疹', '病毒性腸胃炎', '登革熱', '以上皆非'];
const TIME_OPTIONS = [
  '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00',
  '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'
];

interface TeacherLeaveFormProps {
  teacherId: string;
  students: Student[];
  courses: Course[];
  courseMonths: Record<string, number[]>;
  courseCapacity?: Record<string, { enrolled: number; max: number }>;
  defaultTab?: 'leave' | 'course' | 'purchase' | 'departure';
}

export default function TeacherLeaveForm({
  teacherId,
  students,
  courses,
  courseMonths,
  courseCapacity,
  defaultTab = 'leave',
}: TeacherLeaveFormProps) {
  const [requestType, setRequestType] = useState<'leave' | 'course' | 'purchase' | 'departure'>(defaultTab);

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
  const [isAllDay, setIsAllDay] = useState(true);
  const [leaveDate, setLeaveDate] = useState('');
  const [leaveDateEnd, setLeaveDateEnd] = useState('');
  const [leaveTimeStart, setLeaveTimeStart] = useState('08:30');
  const [leaveTimeEnd, setLeaveTimeEnd] = useState('16:30');
  const [leaveType, setLeaveType] = useState('病假');
  const [note, setNote] = useState('');
  const [diseaseType, setDiseaseType] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);

  // 課程異動專用（狀態分離）
  const [selectedEnrollmentIds, setSelectedEnrollmentIds] = useState<string[]>([]); // 取消課程用
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);         // 加報課程用（slot key）
  const [submittedCount, setSubmittedCount] = useState(0);
  const [studentEnrollments, setStudentEnrollments] = useState<StudentEnrollment[]>([]);
  const [enrollmentLoading, startEnrollmentTransition] = useTransition();

  // 購買物品專用
  const [purchaseItem, setPurchaseItem] = useState('T-shirt$250');
  const [purchaseQty, setPurchaseQty] = useState<number | ''>(1);

  // 學生離校專用
  const [departureDate, setDepartureDate] = useState('');

  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function handleStudentChange(val: string) {
    setStudentId(val);
    setSelectedEnrollmentIds([]);
    setSelectedCourseIds([]);
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
    setSelectedEnrollmentIds([]);
    setSelectedCourseIds([]);
    setStudentEnrollments([]);
    setPurchaseQty(1);
    setDepartureDate('');
  }

  function handleTabChange(tab: 'leave' | 'course' | 'purchase' | 'departure') {
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
    setSelectedEnrollmentIds([]);
    setSelectedCourseIds([]);
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
          const finalNote = isAllDay ? note : `[時間: ${leaveTimeStart}-${leaveTimeEnd}] ${note}`.trim();
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
        } else if (requestType === 'purchase') {
          const itemParts = purchaseItem.split('$');
          const payload = JSON.stringify({ item: itemParts[0], price: parseInt(itemParts[1]), qty: purchaseQty || 1 });
          await submitCancelRequest({ teacherId, studentId, courseId: null, reason: payload, requestType: 'purchase' });
        } else if (requestType === 'departure') {
          const payload = JSON.stringify({ date: departureDate, reason });
          await submitCancelRequest({ teacherId, studentId, courseId: null, reason: payload, requestType: 'departure' });
        } else if (courseAction === 'cancel') {
          await Promise.all(
            selectedEnrollmentIds.map(enrollId => {
              const enroll = studentEnrollments.find(e => e.enrollmentId === enrollId);
              return submitCancelRequest({
                teacherId,
                studentId,
                courseId: enroll?.courseId ?? null,
                enrollmentId: enrollId,
                startDate: enroll?.startDate ?? null,
                reason,
                requestType: 'cancel',
              });
            })
          );
          setSubmittedCount(selectedEnrollmentIds.length);
        } else {
          const year = new Date().getFullYear();
          await Promise.all(
            selectedCourseIds.map(slotKey => {
              const { courseId, month } = parseSlotKey(slotKey);
              const startDate = month ? `${year}-${String(month).padStart(2, '0')}-01` : undefined;
              return submitCancelRequest({ teacherId, studentId, courseId, startDate, reason, requestType: 'add' });
            })
          );
          setSubmittedCount(selectedCourseIds.length);
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

  // 加報：以 slot key 展開月份，並排除已報名的 slot
  const enrolledSlots = new Set(studentEnrollments.map((e) => {
    const month = e.startDate ? parseInt(e.startDate.substring(5, 7)) : null;
    return month ? `${e.courseId}|${month}` : e.courseId;
  }));
  const enrolledCourseIds = new Set(studentEnrollments.map((e) => e.courseId));

  const addSlots: { slotKey: string; label: string }[] = [];
  if (courseAction === 'add') {
    for (const c of courses) {
      const months = courseMonths[c.id];
      if (months && months.length > 1) {
        for (const month of months) {
          const slotKey = `${c.id}|${month}`;
          if (!enrolledSlots.has(slotKey)) addSlots.push({ slotKey, label: `${c.name}（${month}月）` });
        }
      } else if (months && months.length === 1) {
        const slotKey = `${c.id}|${months[0]}`;
        if (!enrolledSlots.has(slotKey)) addSlots.push({ slotKey, label: `${c.name}（${months[0]}月）` });
      } else {
        if (!enrolledCourseIds.has(c.id)) addSlots.push({ slotKey: c.id, label: c.name });
      }
    }
  }

  const successMessage = requestType === 'leave'
    ? '✓ 請假通報已送出，等待行政確認後生效。'
    : requestType === 'purchase'
      ? '✓ 購買物品申請已送出，等待行政處理。'
      : requestType === 'departure'
        ? '✓ 學生離校通知已送出，等待行政審核與結算。'
        : courseAction === 'cancel'
          ? `✓ 取消課程申請已送出（共 ${submittedCount} 筆），行政確認後將自動更新合約狀態。`
          : `✓ 加報課程申請已送出（共 ${submittedCount} 筆），行政確認後將建立候補合約。`;

  const needsProof = requestType === 'leave' && (
    (leaveType === '病假' && !!diseaseType && diseaseType !== '以上皆非') ||
    (leaveType === '喪假')
  );
  const isSubmittable = requestType === 'leave'
    ? !!studentId && !!reason && !!leaveDate && (!needsProof || !!proofFile)
    : requestType === 'course'
      ? !!studentId && !!reason &&
        (courseAction === 'cancel'
          ? selectedEnrollmentIds.length > 0
          : selectedCourseIds.length > 0)
      : requestType === 'purchase'
        ? !!studentId && !!purchaseQty
        : requestType === 'departure'
          ? !!studentId && !!departureDate && !!reason
          : false;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 主 Tab */}
      {(requestType === 'leave' || requestType === 'course') && (
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
      )}
      {(requestType === 'purchase' || requestType === 'departure') && (
        <div className="mb-6 font-bold text-lg text-teal-900 border-b pb-2">
          {requestType === 'purchase' ? '購買物品申請' : '學生離校通知'}
        </div>
      )}

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
            {courseAction === 'cancel' ? '取消哪些課程合約' : '加報哪些課程'}
            <span className="text-destructive"> *</span>
            <span className="ml-2 text-xs font-normal text-muted-foreground">（可多選）</span>
          </p>
          {enrollmentLoading ? (
            <p className="text-sm text-muted-foreground py-2">載入中...</p>
          ) : !studentId ? (
            <p className="text-sm text-muted-foreground py-2">請先選擇學生</p>
          ) : courseAction === 'cancel' ? (
            studentEnrollments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">該學生目前無生效合約</p>
            ) : (
              <div className="space-y-2 rounded-lg border border-slate-200 bg-white px-4 py-3">
                {studentEnrollments.map((e) => {
                  const monthLabel = e.startDate
                    ? `（${parseInt(e.startDate.substring(5, 7))}月）`
                    : '';
                  return (
                    <label key={e.enrollmentId} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={selectedEnrollmentIds.includes(e.enrollmentId)}
                        onCheckedChange={() =>
                          setSelectedEnrollmentIds(prev =>
                            prev.includes(e.enrollmentId)
                              ? prev.filter(x => x !== e.enrollmentId)
                              : [...prev, e.enrollmentId]
                          )
                        }
                      />
                      <span className="text-sm">{e.courseName}{monthLabel}</span>
                    </label>
                  );
                })}
              </div>
            )
          ) : (
            addSlots.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">無可加報課程</p>
            ) : (
              <div className="space-y-2 rounded-lg border border-slate-200 bg-white px-4 py-3">
                {addSlots.map(({ slotKey, label }) => {
                  const { courseId } = parseSlotKey(slotKey);
                  const cap = courseCapacity?.[courseId];
                  const isFull = cap ? cap.enrolled >= cap.max : false;
                  return (
                    <label key={slotKey} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={selectedCourseIds.includes(slotKey)}
                        onCheckedChange={() =>
                          setSelectedCourseIds(prev =>
                            prev.includes(slotKey) ? prev.filter(x => x !== slotKey) : [...prev, slotKey]
                          )
                        }
                      />
                      <span className="text-sm">{label}</span>
                      {cap && (
                        <span className={`text-xs ${isFull ? 'text-rose-600 font-medium' : 'text-muted-foreground'}`}>
                          （{cap.enrolled}/{cap.max}{isFull ? ' 已額滿，將列候補' : ''}）
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            )
          )}
        </div>
      )}

      {/* 請假專屬欄位 */}
      {requestType === 'leave' && (
        <>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">請假日期與時間</p>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAllDay}
                  onChange={(e) => setIsAllDay(e.target.checked)}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-600"
                />
                全日
              </label>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={leaveDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className={`${inputCls} flex-1`}
                  required
                />
                {!isAllDay && (
                  <select
                    value={leaveTimeStart}
                    onChange={(e) => setLeaveTimeStart(e.target.value)}
                    className={`${selectCls} w-24 sm:w-28 flex-shrink-0 px-2`}
                  >
                    {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                )}
              </div>

              <div className="flex justify-center text-sm text-muted-foreground">
                <span className="bg-muted px-3 py-1 rounded-md">至</span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={leaveDateEnd || leaveDate}
                  min={leaveDate}
                  onChange={(e) => setLeaveDateEnd(e.target.value)}
                  className={`${inputCls} flex-1`}
                />
                {!isAllDay && (
                  <select
                    value={leaveTimeEnd}
                    onChange={(e) => setLeaveTimeEnd(e.target.value)}
                    className={`${selectCls} w-24 sm:w-28 flex-shrink-0 px-2`}
                  >
                    {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                )}
              </div>
            </div>
            {isAllDay && <p className="text-xs text-muted-foreground">單日請假起訖日請選同一天。</p>}
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

      {/* 購買物品欄位 */}
      {requestType === 'purchase' && (
        <>
          <div className="space-y-1">
            <p className="text-sm font-medium">品項 <span className="text-destructive">*</span></p>
            <select className={selectCls} value={purchaseItem} onChange={(e) => setPurchaseItem(e.target.value)} required>
              <option value="T-shirt$250">T-shirt ($250)</option>
              <option value="書包$350">書包 ($350)</option>
            </select>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">數量 <span className="text-destructive">*</span></p>
            <input
              type="number"
              min={1}
              className={inputCls}
              value={purchaseQty}
              onChange={(e) => setPurchaseQty(e.target.value === '' ? '' : parseInt(e.target.value))}
              required
            />
          </div>
        </>
      )}

      {/* 學生離校欄位 */}
      {requestType === 'departure' && (
        <>
          <div className="space-y-1">
            <p className="text-sm font-medium">離校日期 <span className="text-destructive">*</span></p>
            <input
              type="date"
              value={departureDate}
              onChange={(e) => setDepartureDate(e.target.value)}
              className={inputCls}
              required
            />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">離校原因 <span className="text-destructive">*</span></p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="請說明離校原因（如：搬家、轉學等）"
              required
              rows={3}
              className="w-full h-auto rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm resize-none focus:ring-2 focus:ring-teal-600 focus:outline-none transition-shadow"
            />
          </div>
        </>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {success ? (
        <div className="rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-800">
          {successMessage}
        </div>
      ) : (
        <Button type="submit" disabled={pending || !isSubmittable} className="w-full h-12 text-base font-bold shadow-md hover:bg-teal-800 bg-teal-900 text-teal-50 active:scale-[0.98] transition-all mt-4">
          {pending ? '送出中...' : requestType === 'leave' ? '送出請假通報' : requestType === 'purchase' ? '送出購買申請' : requestType === 'departure' ? '送出離校通知' : courseAction === 'cancel' ? '送出取消課程申請' : '送出加報課程申請'}
        </Button>
      )}
    </form>
  );
}
