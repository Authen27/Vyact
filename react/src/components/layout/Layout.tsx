import { useState, type ReactNode } from 'react';
import Sidebar from './Sidebar';
import MobileBar from './MobileBar';
import FloatingTools from './FloatingTools';
import SyncConflictBanner from './SyncConflictBanner';

export default function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <MobileBar onMenu={() => setOpen(true)} />
      <main className="lg:ml-60 min-h-screen relative z-[1]">
        <div className="px-4 lg:px-7 py-5 lg:py-7 pb-14 max-w-[1400px]">
          {/* TD-03 phase B — surfaces optimistic-concurrency conflicts. */}
          <SyncConflictBanner />
          {children}
        </div>
      </main>
      <FloatingTools />
    </div>
  );
}
