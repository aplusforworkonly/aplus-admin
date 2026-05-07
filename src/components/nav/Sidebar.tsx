'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

type LinkDef = { href: string; label: string; countKey?: 'leaves' | 'requests' | 'enrollments'; exact?: boolean };

const links: LinkDef[] = [
  { href: '/students', label: '學生管理' },
  { href: '/parents', label: '家長管理' },
  { href: '/enrollments', label: '報名合約', countKey: 'enrollments' },
  { href: '/courses', label: '課程管理' },
  { href: '/invoices', label: '帳單管理' },
  { href: '/teachers', label: '老師管理' },
  { href: '/admin/classes', label: '分班管理', exact: true },
  { href: '/admin/classes/matrix', label: '分班矩陣' },
  { href: '/leaves', label: '請假管理', countKey: 'leaves' },
  { href: '/admin/requests', label: '異動審核', countKey: 'requests' },
];

export default function Sidebar({
  leavesCount = 0,
  requestsCount = 0,
  enrollmentsCount = 0,
}: {
  leavesCount?: number;
  requestsCount?: number;
  enrollmentsCount?: number;
}) {
  const pathname = usePathname();
  const counts = { leaves: leavesCount, requests: requestsCount, enrollments: enrollmentsCount };

  return (
    <aside className="w-48 border-r min-h-screen p-4 space-y-1 shrink-0">
      <p className="text-xs text-muted-foreground mb-4 font-semibold tracking-wider uppercase px-3">
        耶加 ERP
      </p>
      {links.map((l) => {
        const count = l.countKey ? counts[l.countKey] : 0;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              'flex items-center px-3 py-2 rounded-md text-sm transition-colors',
              l.exact ? pathname === l.href : pathname.startsWith(l.href)
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted'
            )}
          >
            {l.label}
            {count > 0 && (
              <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full bg-red-500 text-white font-medium leading-none">
                {count}
              </span>
            )}
          </Link>
        );
      })}
      <div className="pt-4 mt-4 border-t space-y-1">
        <Link
          href="/login"
          className="block px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted transition-colors"
        >
          老師入口
        </Link>
        <Link
          href="/parent-leave"
          className="block px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted transition-colors"
        >
          家長請假入口
        </Link>
      </div>
    </aside>
  );
}
