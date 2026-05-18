'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { generateAfternoonBasicEnrollments } from '@/actions/afternoon-basic';

export default function GenerateAfternoonBasicButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ added: number; removed: number } | null>(null);
  const router = useRouter();

  async function handleClick() {
    if (!confirm('確定要同步下午基本名單嗎？系統會新增應加入的學生、移除已改報主題營隊的學生，現有班級分配不受影響。')) return;
    setLoading(true);
    try {
      const res = await generateAfternoonBasicEnrollments();
      setResult(res);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={handleClick} disabled={loading} variant="outline" size="sm">
      <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
      {loading
        ? '同步中…'
        : result !== null
          ? `已新增 ${result.added} 筆、移除 ${result.removed} 筆`
          : '同步下午基本名單'}
    </Button>
  );
}
