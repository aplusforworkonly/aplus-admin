'use client';
import { useState } from 'react';
import Link from 'next/link';
import ToggleClassStatusButton from './ToggleClassStatusButton';
import CloneClassModal from './CloneClassModal';

type Teacher = { id: string; name: string; english_name: string | null; department: string | null };

type ClassRow = {
  id: string;
  name: string;
  campus: string;
  category: string;
  program_track: string | null;
  teacher_id: string | null;
  status: 'active' | 'archived';
  student_count: number;
};

export default function ClassRowActions({
  cls,
  teachers,
}: {
  cls: ClassRow;
  teachers: Teacher[];
}) {
  const [showClone, setShowClone] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2 justify-end">
        <Link
          href={`/admin/classes/${cls.id}`}
          className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
        >
          管理
        </Link>
        {cls.status === 'active' && (
          <button
            onClick={() => setShowClone(true)}
            className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          >
            升級複製
          </button>
        )}
        <ToggleClassStatusButton id={cls.id} status={cls.status} />
      </div>
      {showClone && (
        <CloneClassModal
          source={cls}
          teachers={teachers}
          onClose={() => setShowClone(false)}
        />
      )}
    </>
  );
}
