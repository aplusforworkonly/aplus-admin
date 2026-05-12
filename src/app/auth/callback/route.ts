import { NextResponse } from 'next/server';
import { createSessionClient, createServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https';
  const siteOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : origin;
  const code = searchParams.get('code');

  if (code) {
    const session = await createSessionClient();
    const { data, error } = await session.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const supabase = createServerClient();

      // Find teacher by email — normalize to lowercase, limit(1) guards against legacy duplicate records
      const normalizedEmail = (data.user.email ?? '').toLowerCase().trim();
      const { data: teacher } = await supabase
        .from('teachers')
        .select('id, user_id')
        .ilike('email', normalizedEmail)
        .limit(1)
        .maybeSingle();

      if (teacher) {
        // Link user_id on first login
        if (!teacher.user_id) {
          await supabase
            .from('teachers')
            .update({ user_id: data.user.id })
            .eq('id', teacher.id);
        }
        return NextResponse.redirect(new URL('/teacher', siteOrigin));
      }

      // Debug: encode the Google email so admin can see what was returned
      const debugEmail = encodeURIComponent(data.user.email ?? 'no_email');
      return NextResponse.redirect(new URL(`/login?error=not_teacher&debug=${debugEmail}`, siteOrigin));
    }
  }

  return NextResponse.redirect(new URL('/login?error=auth_failed', siteOrigin));
}
