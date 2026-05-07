'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { updateTeacherStudents } from '@/actions/teachers';

type Student = { id: string; name: string };

export default function StudentAssignForm({
  teacherId,
  allStudents,
  assignedIds,
}: {
  teacherId: string;
  allStudents: Student[];
  assignedIds: string[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(assignedIds));
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    setSaved(false);
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleSave() {
    startTransition(async () => {
      await updateTeacherStudents(teacherId, [...selected]);
      setSaved(true);
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">勾選這位老師負責的學生：</p>
      <div className="grid grid-cols-2 gap-1 max-h-80 overflow-y-auto">
        {allStudents.map((s) => (
          <label
            key={s.id}
            className="flex items-center gap-2 text-sm p-2 rounded hover:bg-muted cursor-pointer"
          >
            <input
              type="checkbox"
              checked={selected.has(s.id)}
              onChange={() => toggle(s.id)}
              className="rounded"
            />
            {s.name}
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={pending}>儲存</Button>
        {saved && <span className="text-sm text-green-700">已儲存</span>}
      </div>
    </div>
  );
}
