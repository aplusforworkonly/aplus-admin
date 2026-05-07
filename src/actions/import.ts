'use server';
import { createServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

const SHEET_ID = '1GFwg_AEC7T5ykuEWfYxCA3Z6un1WHRdgp9jWuPs_d3I';

// 三個部門分頁的 GID
const SHEET_GIDS = [1007490172, 1245059248, 66473233]; // 教學部、英語部、學務部

// Column indices (0-based) — update here when Sheet adds columns
const COL = {
  department: 0,
  english_name: 1,
  name: 2,
  email: 3,
  status: 4,
  campus: 5,   // not yet in Sheet; will be null until column is added
};

function parseCSV(text: string): string[][] {
  return text
    .split('\n')
    .map((line) => line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, '')));
}

export async function importTeachersFromSheet(): Promise<{ imported: number; skipped: number; error?: string }> {
  let allRows: string[][] = [];
  try {
    const results = await Promise.all(
      SHEET_GIDS.map((gid) =>
        fetch(
          `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`,
          { cache: 'no-store' }
        ).then(async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status} (gid=${gid})`);
          return res.text();
        })
      )
    );
    // 每個分頁各自 skip header 第一行後合併
    allRows = results.flatMap((csv) => parseCSV(csv).slice(1));
  } catch (e) {
    return { imported: 0, skipped: 0, error: '無法讀取 Google Sheet，請確認試算表已公開共用。' };
  }

  const rows = allRows;

  const seen = new Map<string, {
    name: string; english_name: string | null; email: string;
    department: string | null; campus: string | null; status: string;
  }>();
  for (const r of rows) {
    const email = r[COL.email]?.toLowerCase().trim();
    if (!email) continue;
    seen.set(email, {
      name: r[COL.name] ?? '',
      english_name: r[COL.english_name] || null,
      email,
      department: r[COL.department] || null,
      campus: r[COL.campus] || null,
      status: r[COL.status]?.trim() === '離職' ? '離職' : '在職',
    });
  }
  const toImport = [...seen.values()].filter((t) => t.name && t.email);

  if (toImport.length === 0) {
    return { imported: 0, skipped: 0, error: '沒有找到老師資料。' };
  }

  const supabase = createServerClient();
  const { error } = await supabase
    .from('teachers')
    .upsert(toImport, { onConflict: 'email', ignoreDuplicates: false });

  if (error) return { imported: 0, skipped: 0, error: error.message };

  revalidatePath('/teachers');
  return { imported: toImport.length, skipped: rows.length - toImport.length };
}
