import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const { svid, hash } = body as Record<string, string>;
  if (!svid || !hash) {
    return NextResponse.json({ error: 'missing svid or hash' }, { status: 400 });
  }

  const { error } = await supabase
    .from('webhook_queue')
    .insert({ svid, hash, source: 'surveycake' });

  if (error) {
    console.error('[webhook] insert failed:', error.message);
    return NextResponse.json({ error: 'db error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
