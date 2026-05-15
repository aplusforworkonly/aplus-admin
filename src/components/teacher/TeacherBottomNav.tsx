'use client';
import { CalendarRange, BookOpenText, Users, ShoppingBag, LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function TeacherBottomNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'leave');

  useEffect(() => {
    setActiveTab(searchParams.get('tab') || 'leave');
  }, [searchParams]);

  useEffect(() => {
    const handleTabChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      setActiveTab(customEvent.detail);
    };
    window.addEventListener('teacherTabChange', handleTabChange);
    return () => window.removeEventListener('teacherTabChange', handleTabChange);
  }, []);

  const view = searchParams.get('view');

  function withView(href: string) {
    if (!view) return href;
    const sep = href.includes('?') ? '&' : '?';
    return `${href}${sep}view=${view}`;
  }

  const navItems = [
    {
      id: 'leave',
      label: '學生請假',
      href: withView('/teacher?tab=leave'),
      icon: CalendarRange,
      isActive: pathname === '/teacher' && activeTab === 'leave',
    },
    {
      id: 'course',
      label: '課程變動',
      href: withView('/teacher?tab=course'),
      icon: BookOpenText,
      isActive: pathname === '/teacher' && activeTab === 'course',
    },
    {
      id: 'purchase',
      label: '購買物品',
      href: withView('/teacher?tab=purchase'),
      icon: ShoppingBag,
      isActive: pathname === '/teacher' && activeTab === 'purchase',
    },
    {
      id: 'departure',
      label: '學生離校',
      href: withView('/teacher?tab=departure'),
      icon: LogOut,
      isActive: pathname === '/teacher' && activeTab === 'departure',
    },
    {
      id: 'students',
      label: '報名狀況',
      href: withView('/teacher/students'),
      icon: Users,
      isActive: pathname === '/teacher/students',
    },
  ];

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, item: typeof navItems[0]) => {
    if (pathname === '/teacher' && item.href.startsWith('/teacher?tab=')) {
      e.preventDefault();
      setActiveTab(item.id);
      window.history.pushState(null, '', item.href);
      window.dispatchEvent(new CustomEvent('teacherTabChange', { detail: item.id }));
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center py-2 bg-white border-t border-slate-200 z-50">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.label}
            href={item.href}
            onClick={(e) => handleNavClick(e, item)}
            className={`flex flex-col items-center justify-center p-1.5 rounded-xl transition-all ${
              item.isActive
                ? 'bg-primary/10 text-primary scale-100 font-semibold px-2'
                : 'text-muted-foreground hover:bg-slate-50 scale-95 font-medium'
            }`}
          >
            <Icon className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] leading-tight whitespace-nowrap">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
