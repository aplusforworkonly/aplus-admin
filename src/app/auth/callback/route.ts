import { NextResponse } from 'next/server';
import { createSessionClient, createServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const session = await createSessionClient();
    const { data, error } = await session.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const supabase = createServerClient();

      // Find teacher by email (case-insensitive)
      const { data: teacher, error: teacherError } = await supabase
        .from('teachers')
        .select('id, user_id')
        .ilike('email', data.user.email ?? '')
        .maybeSingle();

      if (teacher) {
        // Link user_id on first login
        if (!teacher.user_id) {
          await supabase
            .from('teachers')
            .update({ user_id: data.user.id })
            .eq('id', teacher.id);
        }
        return NextResponse.redirect(new URL('/teacher', origin));
      }

      // Debug: encode the Google email so admin can see what was returned
      const debugEmail = encodeURIComponent(data.user.email ?? 'no_email');
      return NextResponse.redirect(new URL(`/login?error=not_teacher&debug=${debugEmail}`, origin));
    }
  }

  return NextResponse.redirect(new URL('/login?error=auth_failed', origin));
}
