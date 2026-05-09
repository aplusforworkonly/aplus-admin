import { Menu, UserCircle } from 'lucide-react';
import Link from 'next/link';

export default function TeacherTopBar() {
  return (
    <header className="bg-teal-950 text-teal-50 fixed top-0 left-0 w-full h-16 flex justify-between items-center px-4 z-50 shadow-md">
      <div className="flex items-center gap-4">
        <button className="p-2 -ml-2 rounded-full hover:bg-teal-900 transition-colors">
          <Menu className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-bold">學生異動申請</h1>
      </div>
      <div className="flex items-center">
        <button className="p-2 -mr-2 rounded-full hover:bg-teal-900 transition-colors">
          <UserCircle className="w-6 h-6" />
        </button>
      </div>
    </header>
  );
}
