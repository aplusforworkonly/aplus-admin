'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import { getPendingCounts } from '@/actions/pending-count';

const HIDDEN_PATHS = ['/teacher', '/login', '/auth', '/parent-leave'];

export default function ConditionalSidebar() {
  const pathname = usePathname();
  const [counts, setCounts] = useState({ leaves: 0, requests: 0, studentReviews: 0, adminTasks: 0 });
  const lastFetchedRef = useRef<number>(0);

  useEffect(() => {
    if (Date.now() - lastFetchedRef.current < 3000) return;
    lastFetchedRef.current = Date.now();
    getPendingCounts().then(setCounts);
  }, [pathname]);

  if (HIDDEN_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) return null;
  return (
    <Sidebar
      leavesCount={counts.leaves}
      requestsCount={counts.requests}
      studentReviewsCount={counts.studentReviews}
      adminTasksCount={counts.adminTasks}
    />
  );
}
