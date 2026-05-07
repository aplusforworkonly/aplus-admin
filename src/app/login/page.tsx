'use client';
import { createClient } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function LoginForm() {
  const searchParams = useSearchParams();
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
