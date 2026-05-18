import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(toSet) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (pathname.startsWith('/teacher') && !user) {
    const fwdHost = request.headers.get('x-forwarded-host');
    const fwdProto = request.headers.get('x-forwarded-proto') ?? 'https';
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ??
      (fwdHost ? `${fwdProto}://${fwdHost}` : null) ??
      (request.nextUrl.origin.startsWith('http://localhost') || request.nextUrl.origin.startsWith('http://10.')
        ? 'https://aplus-admin.zeabur.app'
        : request.nextUrl.origin);
    return NextResponse.redirect(new URL('/login', origin));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/teacher/:path*', '/login'],
};
