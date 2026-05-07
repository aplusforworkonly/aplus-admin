'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createCourse, updateCourse } from '@/actions/courses';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Course, CourseType, BillingCycle } from '@/lib/supabase/types';

const COURSE_TYPE_LABELS: Record<string, string> = {
  main_course: '基本課程',
  camp: '營隊',
  trip: '校外活動',
  material: '教材',
};

const BILLING_LABELS: Record<string, string> = {
  monthly: '月繳',
  quarterly: '季繳',
  one_time: '單次',
};

export default function CourseForm({ course }: { course?: Course }) {
  const router = useRouter();
  const isNew = !course;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: course?.name ?? '',
    course_type: course?.course_type ?? 'main_course' as CourseType,
    billing_cycle: course?.billing_cycle ?? 'one_time' as BillingCycle,
    base_price: course?.base_price ?? 0,
    max_capacity: course?.max_capacity ?? '',
    is_overnight: course?.is_overnight ?? false,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = {
        name: form.name,
        course_type: form.course_type,
        billing_cycle: form.billing_cycle,
        base_price: Number(form.base_price),
        max_capacity: form.max_capacity === '' ? null : Number(form.max_capacity),
        is_overnight: form.is_overnight,
      };
      if (isNew) {
        await createCourse(payload);
      } else {
        await updateCourse(course.id, payload);
      }
      router.push('/courses');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '儲存失敗');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>課程資料</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="name">課程名稱 *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>課程類型</Label>
              <Select
                value={form.course_type}
                onValueChange={(v) => setForm((p) => ({ ...p, course_type: v as CourseType }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(COURSE_TYPE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>收費週期</Label>
              <Select
                value={form.billing_cycle}
                onValueChange={(v) => setForm((p) => ({ ...p, billing_cycle: v as BillingCycle }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(BILLING_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="base_price">原價（元）</Label>
              <Input
                id="base_price"
                type="number"
                min={0}
                value={form.base_price}
                onChange={(e) => setForm((p) => ({ ...p, base_price: e.target.value as unknown as number }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="max_capacity">名額上限（空白 = 不限）</Label>
              <Input
                id="max_capacity"
                type="number"
                min={1}
                value={form.max_capacity}
                placeholder="不限"
                onChange={(e) => setForm((p) => ({ ...p, max_capacity: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>過夜課程</Label>
            <Select
              value={form.is_overnight ? 'yes' : 'no'}
              onValueChange={(v) => setForm((p) => ({ ...p, is_overnight: v === 'yes' }))}
            >
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="no">否</SelectItem>
                <SelectItem value="yes">是</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? '儲存中...' : isNew ? '建立課程' : '儲存變更'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          取消
        </Button>
      </div>
    </form>
  );
}
