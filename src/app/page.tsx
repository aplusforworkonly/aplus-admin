import Link from 'next/link';

const PORTALS = [
  {
    href: '/students',
    title: '行政後台',
    description: '學生管理、分班、請假紀錄、帳單',
    icon: '🏫',
  },
  {
    href: '/login',
    title: '老師入口',
    description: '學生請假通報（Google 帳號登入）',
    icon: '👩‍🏫',
  },
  {
    href: '/parent-leave',
    title: '家長請假',
    description: '為孩子送出請假申請',
    icon: '👨‍👩‍👧',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 px-4 gap-10">
      <div className="text-center space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">耶加教育管理系統</h1>
        <p className="text-muted-foreground text-sm">請選擇您的入口</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl">
        {PORTALS.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            className="flex flex-col gap-3 rounded-xl border bg-background p-6 shadow-sm hover:shadow-md hover:border-primary/40 transition-all"
          >
            <span className="text-3xl">{p.icon}</span>
            <div>
              <p className="font-semibold text-base">{p.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{p.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
