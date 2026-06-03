import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'crypto';
import type { FrequencyType } from '@/lib/supabase/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 使用 timingSafeEqual 防止 timing attack：
// 把兩個字串轉成等長 Buffer，長度不同時補零，再比較。
function verifySecret(provided: string): boolean {
  const expected = process.env.ROUTINE_TRIGGER_SECRET ?? '';
  if (!expected) return false;
  const a = Buffer.from(provided.padEnd(expected.length, '\0'));
  const b = Buffer.from(expected.padEnd(provided.length, '\0'));
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

interface RoutineDef {
  id: string;
  title: string;
  description: string | null;
  frequency_type: FrequencyType;
  frequency_value: number | null;
  advance_days: number;
  campus: string[] | null;
  assigned_to: string | null;
  size: string;
  priority: string;
}

/**
 * 判斷今天是否應該產生實例，並回傳到期日（ISO date string）。
 * advance_days = 提前幾天觸發：
 *   今天 + advance_days = 任務的到期日
 *   反推：若到期日符合條件，就產生任務。
 */
function shouldGenerateToday(def: RoutineDef, today: Date): { ok: boolean; dueDate: string } {
  const advance = def.advance_days ?? 0;
  // 預計到期日 = 今天 + advance_days
  const due = new Date(today);
  due.setDate(due.getDate() + advance);
  const dueDate = due.toISOString().split('T')[0];

  if (def.frequency_type === 'daily') {
    return { ok: true, dueDate };
  }

  if (def.frequency_type === 'weekly') {
    // frequency_value: 1=一 … 6=六 7=日
    const target = def.frequency_value;
    if (target == null) return { ok: false, dueDate: '' };
    const dow = due.getDay() === 0 ? 7 : due.getDay();
    return { ok: dow === target, dueDate };
  }

  if (def.frequency_type === 'monthly') {
    const target = def.frequency_value;
    if (target == null) return { ok: false, dueDate: '' };
    return { ok: due.getDate() === target, dueDate };
  }

  return { ok: false, dueDate: '' };
}

export async function POST(req: NextRequest) {
  // 驗證 API Key（Bearer token 或 x-api-key header）
  const authHeader = req.headers.get('authorization') ?? '';
  const apiKey = req.headers.get('x-api-key') ?? authHeader.replace('Bearer ', '');

  if (!verifySecret(apiKey)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // 取得台北時間今日（Asia/Taipei, UTC+8）
  const nowTW = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));

  // 取得所有啟用中的例行任務範本
  const { data: defs, error: defsErr } = await supabase
    .from('routine_definitions')
    .select('id, title, description, frequency_type, frequency_value, advance_days, campus, assigned_to, size, priority')
    .eq('is_active', true);

  if (defsErr) {
    console.error('[generate-routine-tasks] fetch defs error:', defsErr.message);
    return NextResponse.json({ error: 'db error' }, { status: 500 });
  }

  const generated: string[] = [];
  const skipped: string[] = [];

  for (const def of defs ?? []) {
    const { ok, dueDate } = shouldGenerateToday(def, nowTW);
    if (!ok) continue;

    // upsert：若該範本當天已存在則略過（由 UNIQUE constraint 保護，用 onConflict ignore）
    const { data: inserted, error: insertErr } = await supabase
      .from('admin_tasks')
      .upsert(
        {
          title: def.title,
          description: def.description,
          task_type: 'routine',
          task_source: 'routine',
          routine_definition_id: def.id,
          campus: def.campus,
          assigned_to: def.assigned_to,
          size: def.size,
          priority: def.priority,
          status: 'pending',
          due_date: dueDate,
        },
        { onConflict: 'routine_definition_id,due_date', ignoreDuplicates: true }
      )
      .select('id');

    if (insertErr) {
      console.error(`[generate-routine-tasks] def ${def.id} error:`, insertErr.message);
      skipped.push(def.id);
    } else if (inserted && inserted.length > 0) {
      generated.push(def.id);
    } else {
      skipped.push(def.id);
    }
  }

  return NextResponse.json({ generated: generated.length, skipped: skipped.length });
}
