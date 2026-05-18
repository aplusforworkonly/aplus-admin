'use client';
import { createClient } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

function detectEnv(): { isInApp: boolean; isAndroid: boolean } {
  if (typeof window === 'undefined') return { isInApp: false, isAndroid: false };
  const ua = navigator.userAgent;
  const isInApp = /Line\//i.test(ua) || /FBAN|FBAV/i.test(ua) || /Instagram/i.test(ua) || /MicroMessenger/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  return { isInApp, isAndroid };
}

// ── Email OTP 登入表單 ────────────────────────────────────────────
function OtpLoginForm({ showChromeButton }: { showChromeButton: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function openInChrome() {
    const url = window.location.href;
    window.location.href = `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
  }

  async function sendOtp() {
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true },
    });
    if (err) {
      setError('找不到此 Email，請確認是否為系統登記的帳號。');
    } else {
      setStep('otp');
    }
    setLoading(false);
  }

  async function verifyOtp() {
    if (!otp.trim()) return;
    setLoading(true);
    setError('');
    const supabase = createClient();
    const { error: err } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: otp.trim(),
      type: 'email',
    });
    if (err) {
      setError('驗證碼錯誤或已過期，請重新發送。');
    } else {
      router.push('/teacher');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="bg-background rounded-xl border shadow-sm p-8 w-full max-w-sm space-y-5">
        <div className="text-center">
          <h1 className="text-xl font-bold">耶加教育管理系統</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {step === 'email' ? '請輸入您的 Email 收取驗證碼' : `驗證碼已寄至 ${email}`}
          </p>
        </div>

        {step === 'email' ? (
          <div className="space-y-3">
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendOtp()}
              className="w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              autoFocus
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button className="w-full" onClick={sendOtp} disabled={loading || !email.trim()}>
              {loading ? '發送中…' : '發送驗證碼'}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              type="text"
              inputMode="numeric"
              placeholder="6 位數驗證碼"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && verifyOtp()}
              className="w-full border border-input rounded-md px-3 py-2 text-sm text-center tracking-widest focus:outline-none focus:ring-1 focus:ring-ring"
              maxLength={6}
              autoFocus
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button className="w-full" onClick={verifyOtp} disabled={loading || otp.trim().length < 6}>
              {loading ? '驗證中…' : '登入'}
            </Button>
            <button
              onClick={() => { setStep('email'); setOtp(''); setError(''); }}
              className="w-full text-xs text-muted-foreground hover:text-foreground"
            >
              重新發送驗證碼
            </button>
          </div>
        )}

        {showChromeButton && (
          <div className="border-t pt-4 text-center space-y-2">
            <p className="text-xs text-muted-foreground">或直接用 Chrome 開啟</p>
            <Button variant="outline" className="w-full text-sm" onClick={openInChrome}>
              用 Chrome 開啟
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Google OAuth 登入（桌機/外部瀏覽器）────────────────────────────
function GoogleLoginForm() {
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
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <div className="bg-background rounded-xl border shadow-sm p-10 w-full max-w-sm space-y-6 text-center">
        <div>
          <h1 className="text-2xl font-bold">耶加教育管理系統</h1>
          <p className="text-sm text-muted-foreground mt-1">請使用 Google 帳號登入</p>
        </div>
        {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
        <Button className="w-full" size="lg" onClick={handleGoogleLogin}>
          以 Google 帳號登入
        </Button>
      </div>
    </div>
  );
}

// ── 主元件：偵測環境後決定顯示哪個表單 ────────────────────────────
function LoginForm() {
  const [env, setEnv] = useState<{ isInApp: boolean; isAndroid: boolean } | null>(null);

  useEffect(() => {
    setEnv(detectEnv());
  }, []);

  if (env === null) return null; // hydration 前不渲染，避免 mismatch

  if (env.isInApp) {
    return <OtpLoginForm showChromeButton={env.isAndroid} />;
  }

  return <GoogleLoginForm />;
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
