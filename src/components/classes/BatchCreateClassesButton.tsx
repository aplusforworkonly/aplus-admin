'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import BatchCreateClassesModal from './BatchCreateClassesModal';

type Teacher = { id: string; name: string; english_name: string | null; department: string | null };

export default function BatchCreateClassesButton({ teachers }: { teachers: Teacher[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        批次建立班級
      </Button>
      {open && <BatchCreateClassesModal teachers={teachers} onClose={() => setOpen(false)} />}
    </>
  );
}
