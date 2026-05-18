'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { rebillStudent } from '@/actions/invoices';

export default function RebillButton({ studentId, billingMonth }: { studentId: string; billingMonth: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleClick() {
    if (!confirm(`確定要重新開帳 ${billingMonth} 的帳單嗎？舊帳單將被刪除並重新計算。`)) return;
    setLoading(true);
    try {
      await rebillStudent(studentId, billingMonth);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 disabled:opacity-40 whitespace-nowrap"
    >
      {loading ? '處理中…' : '重新開帳'}
    </button>
  );
}
