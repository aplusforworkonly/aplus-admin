'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import BatchImportModal from './BatchImportModal';

export default function BatchImportButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        批次匯入分班
      </Button>
      {open && <BatchImportModal onClose={() => setOpen(false)} />}
    </>
  );
}
