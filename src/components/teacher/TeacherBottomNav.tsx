'use client';
import { CalendarRange, BookOpenText, Users } from 'lucide-react';
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

  const navItems = [
    {
      id: 'leave',
      label: '學生請假',
      href: '/teacher?tab=leave',
      icon: CalendarRange,
      isActive: pathname === '/teacher' && activeTab !== 'course',
    },
    {
      id: 'course',
      label: '課程變動',
      href: '/teacher?tab=course',
      icon: BookOpenText,
      isActive: pathname === '/teacher' && activeTab === 'course',
    },
    {
      id: 'students',
      label: '報名狀況',
      href: '/teacher/students',
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
            className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${
              item.isActive
                ? 'bg-teal-50 text-teal-900 scale-100 font-semibold px-4'
                : 'text-slate-500 hover:bg-slate-50 scale-95 font-medium'
            }`}
          >
            <Icon className="w-6 h-6 mb-1" />
            <span className="text-[11px] leading-tight">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
