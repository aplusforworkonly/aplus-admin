'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type CountKey = 'leaves' | 'requests' | 'studentReviews' | 'adminTasks';

type Child = {
  href: string;
  label: string;
  countKey?: CountKey;
  exact?: boolean;
};

type Group = {
  label: string;
  children: Child[];
};

const groups: Group[] = [
  {
    label: '學生專區',
    children: [
      { href: '/students', label: '學生資料', exact: true },
      { href: '/parents', label: '家長資料' },
      { href: '/enrollments', label: '報名合約' },
      { href: '/admin/roster', label: '報名資料總覽' },
      { href: '/courses', label: '課程項目', exact: true },
      { href: '/admin/waitlist', label: '課程候補管理' },
      { href: '/courses/stats', label: '報名人數統計' },
      { href: '/leaves/calendar', label: '學生請假日曆' },
    ],
  },
  {
    label: '老師專區',
    children: [
      { href: '/teachers', label: '老師資料' },
      { href: '/admin/classes/matrix', label: '分班管理' },
      { href: '/admin/rostering-permissions', label: '權限管理' },
    ],
  },
  {
    label: '行政專區',
    children: [
      { href: '/invoices', label: '帳單管理' },
      { href: '/leaves', label: '請假審核', countKey: 'leaves', exact: true },
      { href: '/admin/requests', label: '課程異動審核', countKey: 'requests' },
      { href: '/admin/student-reviews', label: '學生資料審核', countKey: 'studentReviews' },
    ],
  },
  {
    label: '任務管理專區',
    children: [
      { href: '/admin/tasks', label: '任務管理', countKey: 'adminTasks' },
      { href: '/admin/task-routing', label: '指派規則設定' },
    ],
  },
];

export default function Sidebar({
  leavesCount = 0,
  requestsCount = 0,
  studentReviewsCount = 0,
  adminTasksCount = 0,
}: {
  leavesCount?: number;
  requestsCount?: number;
  studentReviewsCount?: number;
  adminTasksCount?: number;
}) {
  const pathname = usePathname();
  const counts: Record<CountKey, number> = {
    leaves: leavesCount,
    requests: requestsCount,
    studentReviews: studentReviewsCount,
    adminTasks: adminTasksCount,
  };

  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function open(label: string) {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenGroup(label);
  }

  function scheduleClose() {
    closeTimer.current = setTimeout(() => setOpenGroup(null), 120);
  }

  return (
    <aside className="w-48 border-r min-h-screen p-4 space-y-1 shrink-0">
      <p className="text-xs text-muted-foreground mb-4 font-semibold tracking-wider uppercase px-3">
        耶加 ERP
      </p>

      {groups.map((group) => {
        const isGroupActive = group.children.some((child) =>
          child.exact ? pathname === child.href : pathname.startsWith(child.href)
        );
        const groupCount = group.children.reduce(
          (sum, child) => sum + (child.countKey ? counts[child.countKey] : 0),
          0
        );
        const isOpen = openGroup === group.label;

        return (
          <div
            key={group.label}
            className="relative"
            onMouseEnter={() => open(group.label)}
            onMouseLeave={scheduleClose}
          >
            <div
              className={cn(
                'flex items-center px-3 py-2 rounded-md text-sm transition-colors cursor-default select-none',
                isGroupActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              )}
            >
              <span className="flex-1">{group.label}</span>
              {groupCount > 0 && (
                <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full bg-red-500 text-white font-medium leading-none">
                  {groupCount}
                </span>
              )}
            </div>

            {/* Flyout submenu — stays open while mouse is over parent OR submenu */}
            {isOpen && (
              <div
                className="absolute left-full top-0 z-50 pl-1"
                onMouseEnter={() => open(group.label)}
                onMouseLeave={scheduleClose}
              >
                <div className="bg-background border rounded-md shadow-lg py-1 min-w-40">
                  {group.children.map((child) => {
                    const isActive = child.exact
                      ? pathname === child.href
                      : pathname.startsWith(child.href);
                    const count = child.countKey ? counts[child.countKey] : 0;
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          'flex items-center px-4 py-2 text-sm transition-colors cursor-pointer',
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-accent hover:text-accent-foreground'
                        )}
                      >
                        <span className="flex-1">{child.label}</span>
                        {count > 0 && (
                          <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-red-500 text-white font-medium leading-none">
                            {count}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
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
          href="/teacher/tasks"
          className="block px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted transition-colors"
        >
          任務管理入口
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
