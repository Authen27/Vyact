import { useState, type ReactNode } from 'react';
import Sidebar from './Sidebar';
import MobileBar from './MobileBar';

export default function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <MobileBar onMenu={() => setOpen(true)} />
      <main className="lg:ml-60 min-h-screen relative z-[1]">
        <div className="px-4 lg:px-7 py-5 lg:py-7 pb-14 max-w-[1400px]">
          {children}
        </div>
      </main>
    </div>
  );
}
