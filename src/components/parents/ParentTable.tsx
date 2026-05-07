'use client';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import EditParentDialog from '@/components/parents/EditParentDialog';

type StudentInfo = {
  id: string;
  name: string;
  english_name: string | null;
  status: string;
};

type Mapping = {
  relationship: string;
  students: StudentInfo | null;
};

export type ParentRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  line_id: string | null;
  parent_student_mapping: Mapping[];
};

export default function ParentTable({ parents }: { parents: ParentRow[] }) {
  const [q, setQ] = useState('');
  const [editTarget, setEditTarget] = useState<ParentRow | null>(null);

  const filtered = q.trim()
    ? parents.filter((p) => {
        const lq = q.toLowerCase().trim();
        if ((p.name ?? '').toLowerCase().includes(lq)) return true;
        if ((p.phone ?? '').replace(/\D/g, '').includes(lq.replace(/\D/g, ''))) return true;
        return p.parent_student_mapping.some((m) => {
          const s = m.students;
          if (!s) return false;
          if ((s.name ?? '').includes(q.trim())) return true;
          if ((s.english_name ?? '').toLowerCase().includes(lq)) return true;
          return false;
        });
      })
    : parents;

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <Input
          placeholder="搜尋家長姓名、電話、學生中英文姓名…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm h-8 text-sm"
        />
        <span className="text-xs text-muted-foreground">
          {q ? `${filtered.length} / ${parents.length} 筆` : `共 ${parents.length} 筆`}
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>姓名</TableHead>
            <TableHead>手機</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>LINE ID</TableHead>
            <TableHead>關聯學生</TableHead>
            <TableHead className="w-16" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                {q ? '找不到符合的家長' : '尚無家長資料'}
              </TableCell>
            </TableRow>
          )}
          {filtered.map((parent) => (
            <TableRow key={parent.id}>
              <TableCell className="font-medium">{parent.name || '—'}</TableCell>
              <TableCell className="font-mono text-sm">{parent.phone}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {parent.email ?? '—'}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {parent.line_id ?? '—'}
              </TableCell>
              <TableCell className="text-sm">
                {parent.parent_student_mapping.length > 0
                  ? parent.parent_student_mapping.map((m) => (
                      <span key={m.students?.id} className="inline-flex items-center gap-1 mr-2">
                        {m.students?.name}
                        {m.students?.english_name && (
                          <span className="text-muted-foreground text-xs">
                            ({m.students.english_name})
                          </span>
                        )}
                        <Badge
                          variant={m.students?.status === '就讀中' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {m.relationship}
                        </Badge>
                      </span>
                    ))
                  : '—'}
              </TableCell>
              <TableCell>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => setEditTarget(parent)}
                >
                  編輯
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {editTarget && (
        <EditParentDialog
          parent={editTarget}
          onClose={() => setEditTarget(null)}
        />
      )}
    </>
  );
}
