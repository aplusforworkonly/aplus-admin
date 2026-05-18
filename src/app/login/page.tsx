'use client';
import { createClient } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

function detectInAppBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  return /Line\//i.test(ua) || /FBAN|FBAV/i.test(ua) || /Instagram/i.test(ua) || /MicroMessenger/i.test(ua);
}

function InAppBrowserWarning() {
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUrl(window.location.href);
  }, []);

  async function copyUrl() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="bg-background rounded-xl border shadow-sm p-8 w-full max-w-sm space-y-5 text-center">
        <div className="text-4xl">⚠️</div>
        <div>
          <h1 className="text-xl font-bold">請用瀏覽器開啟</h1>
          <p className="text-sm text-muted-foreground mt-2">
            目前是在 LINE 或 App 內開啟，Google 登入在此環境下會被封鎖。
          </p>
        </div>
        <div className="bg-muted rounded-lg p-4 text-left space-y-2 text-sm">
          <p className="font-medium">LINE 使用者操作步驟：</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>點右上角的「⋯」選單</li>
            <li>選「用預設瀏覽器開啟」</li>
            <li>再重新點「以 Google 帳號登入」</li>
          </ol>
        </div>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">或複製網址，貼到 Chrome / Safari 開啟</p>
          <Button variant="outline" className="w-full text-sm" onClick={copyUrl}>
            {copied ? '已複製 ✓' : '複製網址'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const [isInApp, setIsInApp] = useState(false);

  useEffect(() => {
    setIsInApp(detectInAppBrowser());
  }, []);

  if (isInApp) return <InAppBrowserWarning />;

  const error = searchParams.get('error');
  const debugEmail = searchParams.get('debug');
  const errorMessage =
    error === 'not_teacher' ? `此 Google 帳號尚未被設定為老師，請聯繫行政人員。${debugEmail ? `（嘗試登入的帳號：${debugEmail}）` : ''}` :
    error === 'auth_failed' ? '登入失敗，請再試一次。' : null;

  async function handleGoogleLogin() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <div className="bg-background rounded-xl border shadow-sm p-10 w-full max-w-sm space-y-6 text-center">
        <div>
          <h1 className="text-2xl font-bold">耶加教育管理系統</h1>
          <p className="text-sm text-muted-foreground mt-1">請使用 Google 帳號登入</p>
        </div>
        {errorMessage && (
          <p className="text-sm text-destructive">{errorMessage}</p>
        )}
        <Button className="w-full" size="lg" onClick={handleGoogleLogin}>
          以 Google 帳號登入
        </Button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
