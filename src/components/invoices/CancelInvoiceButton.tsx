'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cancelInvoice } from '@/actions/invoices';

export default function CancelInvoiceButton({ invoiceId, invoiceNo }: { invoiceId: string; invoiceNo: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleClick() {
    if (!confirm(`確定要取消帳單 ${invoiceNo} 嗎？此操作將刪除帳單紀錄，無法復原。`)) return;
    setLoading(true);
    try {
      await cancelInvoice(invoiceId);
      router.push('/invoices');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="text-xs text-red-500 hover:text-red-700 underline underline-offset-2 disabled:opacity-40 whitespace-nowrap"
    >
      {loading ? '處理中…' : '取消開帳'}
    </button>
  );
}
