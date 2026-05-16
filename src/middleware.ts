import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // LINE WebView 無法完成 Google OAuth，偵測後用 JS 跳轉至外部瀏覽器
  const ua = request.headers.get('user-agent') ?? '';
  const isLineWebView = /Line\//i.test(ua);
  const alreadyRedirected = request.nextUrl.searchParams.has('openExternalBrowser');

  if (isLineWebView && !alreadyRedirected && pathname.startsWith('/teacher')) {
    const redirectUrl = new URL(request.url);
    redirectUrl.searchParams.set('openExternalBrowser', '1');
    const safeUrl = redirectUrl.toString().replace(/'/g, '%27');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><script>window.location.replace('${safeUrl}')</script></head><body></body></html>`;
    return new NextResponse(html, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

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
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/teacher/:path*', '/login'],
};
