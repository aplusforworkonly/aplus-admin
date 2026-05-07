'use client';
import { useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { submitParentLeaveRequest } from '@/actions/leave-requests';
import { uploadMedicalProof } from '@/actions/upload';

type Student = { id: string; name: string };

const LEAVE_TYPES = ['病假', '事假', '喪假', '活動日', '其他'];
const DISEASE_TYPES = ['腸病毒', '流感', '水痘', '麻疹', '病毒性腸胃炎', '登革熱', '以上皆非'];

const selectCls = 'w-full h-9 rounded-md border border-input bg-background px-3 text-sm max-w-xs';

export default function ParentLeaveForm() {
  const [phone, setPhone] = useState('');
  const [students, setStudents] = useState<Student[] | null>(null);
  const [studentId, setStudentId] = useState('');
  const [leaveDate, setLeaveDate] = useState('');
  const [leaveDateEnd, setLeaveDateEnd] = useState('');
  const [leaveType, setLeaveType] = useState('病假');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [diseaseType, setDiseaseType] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [lookupError, setLookupError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState(false);
  const [lookupPending, startLookup] = useTransition();
  const [submitPending, startSubmit] = useTransition();

  const needsProof = leaveType === '病假' && !!diseaseType && diseaseType !== '以上皆非';

  function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setLookupError('');
    setStudents(null);
    setStudentId('');
    setSuccess(false);
    startLookup(async () => {
      const res = await fetch(`/api/parent-students?phone=${encodeURIComponent(phone)}`);
      const data = await res.json();
      if (!res.ok || data.length === 0) {
        setLookupError('查無此手機號碼，請確認後再試。');
        return;
      }
      setStudents(data);
      if (data.length === 1) setStudentId(data[0].id);
    });
  }

  function handleStartDateChange(val: string) {
    setLeaveDate(val);
    if (leaveDateEnd && leaveDateEnd < val) setLeaveDateEnd(val);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError('');
    startSubmit(async () => {
      try {
        let proofFileUrl: string | undefined;
        if (needsProof && proofFile) {
          const fd = new FormData();
          fd.append('file', proofFile);
          fd.append('studentId', studentId);
          proofFileUrl = await uploadMedicalProof(fd);
        }
        await submitParentLeaveRequest({
          phone,
          studentId,
          leaveDate,
          leaveDateEnd: leaveDateEnd || leaveDate,
          leaveType,
          reason,
          note,
          diseaseType: diseaseType || undefined,
          proofFileUrl,
        });
        setSuccess(true);
        setLeaveDate('');
        setLeaveDateEnd('');
        setReason('');
        setNote('');
        setDiseaseType('');
        setProofFile(null);
      } catch (err: unknown) {
        setSubmitError(err instanceof Error ? err.message : '送出失敗，請再試一次。');
      }
    });
  }

  const canSubmit = !!studentId && !!reason && !!leaveDate && (!needsProof || !!proofFile);

  return (
    <div className="space-y-6">
      {/* Step 1: Phone lookup */}
      <div className="space-y-3">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">步驟一：輸入家長手機號碼</h2>
        <form onSubmit={handleLookup} className="flex gap-2">
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0912-345-678"
            className="w-48"
            required
          />
          <Button type="submit" variant="outline" disabled={lookupPending}>
            {lookupPending ? '查詢中...' : '查詢'}
          </Button>
        </form>
        {lookupError && <p className="text-sm text-destructive">{lookupError}</p>}
      </div>

      {/* Step 2: Leave form */}
      {students && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">步驟二：填寫請假資料</h2>

          {students.length > 1 && (
            <div className="space-y-1">
              <p className="text-sm font-medium">選擇學生</p>
              <select
                className={selectCls}
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                required
              >
                <option value="">— 請選擇 —</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          {students.length === 1 && (
            <p className="text-sm">學生：<span className="font-medium">{students[0].name}</span></p>
          )}

          {/* 日期區間 */}
          <div className="space-y-1">
            <p className="text-sm font-medium">請假日期</p>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={leaveDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="w-44"
                required
              />
              <span className="text-sm text-muted-foreground">至</span>
              <Input
                type="date"
                value={leaveDateEnd || leaveDate}
                min={leaveDate}
                onChange={(e) => setLeaveDateEnd(e.target.value)}
                className="w-44"
              />
            </div>
            <p className="text-xs text-muted-foreground">單日請假只需填左側日期；連續請假請填寫起訖日期。</p>
          </div>

          {/* 假別 */}
          <div className="space-y-1">
            <p className="text-sm font-medium">假別</p>
            <select
              className={selectCls}
              value={leaveType}
              onChange={(e) => { setLeaveType(e.target.value); setDiseaseType(''); setProofFile(null); }}
            >
              {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* 疾病類型（病假時顯示） */}
          {leaveType === '病假' && (
            <div className="space-y-1">
              <p className="text-sm font-medium">疾病類型 <span className="text-destructive">*</span></p>
              <select
                className={selectCls}
                value={diseaseType}
                onChange={(e) => { setDiseaseType(e.target.value); setProofFile(null); }}
              >
                <option value="">— 請選擇 —</option>
                {DISEASE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}

          {/* 醫療證明（法定傳染病時必填） */}
          {needsProof && (
            <div className="rounded-lg bg-muted/60 border border-muted-foreground/20 px-4 py-3 space-y-2">
              <p className="text-sm font-medium">
                醫療證明上傳
                <span className="text-destructive"> *</span>
                <span className="ml-2 text-xs font-normal text-muted-foreground">法定傳染病需附證明才可送出</span>
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

          {/* 請假原因（必填） */}
          <div className="space-y-1">
            <p className="text-sm font-medium">請假原因 <span className="text-destructive">*</span></p>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="例：發燒、家庭因素"
              className="max-w-xs"
              required
            />
          </div>

          {/* 備註（選填） */}
          <div className="space-y-1">
            <p className="text-sm font-medium">補充說明（選填）</p>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="其他補充資訊"
              className="max-w-xs"
            />
          </div>

          {submitError && <p className="text-sm text-destructive">{submitError}</p>}

          {success ? (
            <div className="rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-800">
              ✓ 請假申請已送出，等待行政確認後即會生效。如需再次請假請重新填寫。
            </div>
          ) : (
            <Button type="submit" disabled={submitPending || !canSubmit}>
              {submitPending ? '送出中...' : '送出請假申請'}
            </Button>
          )}
        </form>
      )}
    </div>
  );
}
