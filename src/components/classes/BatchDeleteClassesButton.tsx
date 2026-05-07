'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import BatchDeleteClassesModal, { type ClassItem } from './BatchDeleteClassesModal';

export default function BatchDeleteClassesButton({ classes }: { classes: ClassItem[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        批次刪除班級
      </Button>
      {open && <BatchDeleteClassesModal classes={classes} onClose={() => setOpen(false)} />}
    </>
  );
}
