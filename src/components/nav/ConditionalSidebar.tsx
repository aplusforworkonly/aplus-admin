'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import { getPendingCounts } from '@/actions/pending-count';

const HIDDEN_PATHS = ['/teacher', '/login', '/auth', '/parent-leave'];

export default function ConditionalSidebar() {
  const pathname = usePathname();
  const [counts, setCounts] = useState({ leaves: 0, requests: 0, enrollments: 0, studentReviews: 0 });

  useEffect(() => {
    getPendingCounts().then(setCounts);
  }, [pathname]);

  if (HIDDEN_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) return null;
  return <Sidebar leavesCount={counts.leaves} requestsCount={counts.requests} enrollmentsCount={counts.enrollments} studentReviewsCount={counts.studentReviews} />;
}
