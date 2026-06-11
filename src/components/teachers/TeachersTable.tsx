'use client';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { CAMPUSES } from '@/lib/constants';


type Teacher = {
  id: string;
  name: string;
  english_name: string | null;
  email: string;
  campus: string | null;
  department: string | null;
  user_id: string | null;
};

export default function TeachersTable({ teachers }: { teachers: Teacher[] }) {
  const [search, setSearch] = useState('');
  const [campusFilter, setCampusFilter] = useState('all');

  const filtered = teachers.filter((t) => {
    const matchSearch = !search.trim()
      || t.name.includes(search.trim())
      || (t.english_name ?? '').toLowerCase().includes(search.trim().toLowerCase())
      || (t.email ?? '').toLowerCase().includes(search.trim().toLowerCase());
    const matchCampus = campusFilter === 'all' || t.campus === campusFilter;
    return matchSearch && matchCampus;
  });

  const selectCls = 'h-8 rounded-md border border-input bg-background px-2 text-sm';

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          placeholder="搜尋姓名或 Email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs h-8 text-sm"
        />
        <select
          className={selectCls}
          value={campusFilter}
          onChange={(e) => setCampusFilter(e.target.value)}
        >
          <option value="all">全部校區</option>
          {CAMPUSES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground ml-auto">
          {search || campusFilter !== 'all'
            ? `${filtered.length} / ${teachers.length} 人`
            : `共 ${teachers.length} 人`}
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>姓名</TableHead>
            <TableHead>部門</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>校區</TableHead>
            <TableHead className="w-24 text-center">帳號狀態</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                {search || campusFilter !== 'all' ? '找不到符合的老師' : '尚無老師資料'}
              </TableCell>
            </TableRow>
          )}
          {filtered.map((t) => (
            <TableRow key={t.id}>
              <TableCell className="font-medium">
                {t.name}
                {t.english_name && (
                  <span className="text-xs text-muted-foreground ml-1">{t.english_name}</span>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{t.department ?? '—'}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{t.email}</TableCell>
              <TableCell className="text-sm">{t.campus ?? '—'}</TableCell>
              <TableCell className="text-center">
                {t.user_id
                  ? <Badge variant="default">已連結</Badge>
                  : <Badge variant="outline">待登入</Badge>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
