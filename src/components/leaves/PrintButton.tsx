'use client';

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="print:hidden text-xs px-3 py-1.5 rounded-md border border-input hover:bg-muted transition-colors"
    >
      列印
    </button>
  );
}
