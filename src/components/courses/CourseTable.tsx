'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import type { Course } from '@/lib/supabase/types';

const TYPE_LABEL: Record<string, string> = {
  main_course: '基本課程',
  camp: '營隊',
  trip: '校外活動',
  material: '教材',
};

const TYPE_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  main_course: 'default',
  camp: 'secondary',
  trip: 'outline',
  material: 'outline',
};

const BILLING_LABEL: Record<string, string> = {
  monthly: '月繳',
  quarterly: '季繳',
  one_time: '單次',
};

export default function CourseTable({ courses }: { courses: Course[] }) {
  const router = useRouter();
  const [search, setSearch] = useState('');

  const filtered = courses.filter((c) =>
    !search || c.name.includes(search)
  );

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center">
        <Input
          placeholder="搜尋課程名稱..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <span className="text-sm text-muted-foreground ml-auto">{filtered.length} 筆</span>
        <Button onClick={() => router.push('/courses/new')}>＋ 新增課程</Button>
      </div>
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead>課程名稱</TableHead>
            <TableHead className="w-28">類型</TableHead>
            <TableHead className="w-20">收費</TableHead>
            <TableHead className="w-28 text-right">原價</TableHead>
            <TableHead className="w-20 text-right">名額</TableHead>
            <TableHead className="w-16"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                沒有符合條件的課程
              </TableCell>
            </TableRow>
          )}
          {filtered.map((course) => (
            <TableRow key={course.id}>
              <TableCell>
                <span className="font-medium">{course.name}</span>
                {course.is_overnight && (
                  <Badge variant="outline" className="ml-2 text-xs">過夜</Badge>
                )}
              </TableCell>
              <TableCell>
                <Badge variant={TYPE_VARIANT[course.course_type] ?? 'secondary'}>
                  {TYPE_LABEL[course.course_type] ?? course.course_type}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">{BILLING_LABEL[course.billing_cycle] ?? course.billing_cycle}</TableCell>
              <TableCell className="text-right font-mono text-sm">
                ${course.base_price.toLocaleString()}
              </TableCell>
              <TableCell className="text-right text-sm text-muted-foreground">
                {course.max_capacity ?? '不限'}
              </TableCell>
              <TableCell>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/courses/${course.id}`)}
                >
                  編輯
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
