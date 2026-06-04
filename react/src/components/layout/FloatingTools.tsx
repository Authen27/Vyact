// Vyact v6.4 — FloatingTools
//
// Planner and AI Chat used to live as sidebar entries, which (a) felt
// buried for tools that work as overlays on top of any page, and (b)
// required a full route navigation to get to. They now appear as floating
// action buttons in the bottom-right that open a right-side drawer,
// available on every authenticated screen.
//
// Routing for /planner and /chat is preserved for deep links and external
// references, but the primary access point is now the FAB.

import React, { Suspense, useState, useEffect, type ReactNode } from 'react';
import { Sparkles, MessageCircle, X } from 'lucide-react';

const Planner = React.lazy(() => import('../../pages/Planner'));
const Chat = React.lazy(() => import('../../pages/Chat'));

type Tool = 'planner' | 'chat' | null;

import ls from '../../lib/localStorageCompat';
const KEY = 'floating_last';

export default function FloatingTools() {
  const [tool, setTool] = useState<Tool>(null);

  // Esc closes the drawer for keyboard users.
  useEffect(() => {
    if (!tool) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setTool(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tool]);

  function open(t: Tool) {
    setTool(t);
    try { if (t) ls.setString(KEY, t); } catch { /* noop */ }
  }

  return (
    <>
      {/* Stacked FABs in the bottom-right. Sit above the primary AddFab
          (v7.4.4) so the Add-Transaction button stays the most prominent
          action; offset above MobileBar (~56px) on small screens. */}
      <div className="fixed right-4 bottom-[160px] lg:bottom-[88px] z-40 flex flex-col gap-2.5">
        <Fab
          label="Planner"
          tone="coral"
          onClick={() => open('planner')}
          active={tool === 'planner'}
        >
          <Sparkles size={18} />
        </Fab>
        <Fab
          label="Ask Vyact"
          tone="denim"
          onClick={() => open('chat')}
          active={tool === 'chat'}
        >
          <MessageCircle size={18} />
        </Fab>
      </div>

      {tool && (
        <Drawer onClose={() => setTool(null)} title={tool === 'planner' ? 'Planner' : 'Ask Vyact'}>
          <Suspense fallback={<DrawerLoadingState />}>
            {tool === 'planner' ? <Planner /> : <Chat />}
          </Suspense>
        </Drawer>
      )}
    </>
  );
}

function DrawerLoadingState() {
  return <div className="mono-label">Loading…</div>;
}

interface FabProps {
  label: string;
  tone: 'coral' | 'denim';
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}
function Fab({ label, tone, active, onClick, children }: FabProps) {
  const bg = tone === 'coral' ? 'bg-coral hover:bg-coral/90' : 'bg-denim hover:bg-denim/90';
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`group flex items-center gap-2 ${bg} text-white rounded-full shadow-2 transition-all
                  px-3.5 h-11 hover:pr-4 hover:scale-[1.03] ${active ? 'ring-2 ring-white/50' : ''}`}
    >
      {children}
      <span className="font-mono text-[0.6rem] tracking-[0.14em] uppercase font-semibold hidden sm:inline">
        {label}
      </span>
    </button>
  );
}

interface DrawerProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}
function Drawer({ title, onClose, children }: DrawerProps) {
  return (
    <div
      className="fixed inset-0 z-[150] flex justify-end"
      style={{ background: 'hsl(var(--shadow) / 0.45)', backdropFilter: 'blur(2px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-bg2 border-l border-line2 h-full w-full sm:w-[min(28rem,100vw)] flex flex-col shadow-3 animate-slideInRight">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <h3 className="display-italic text-[1.2rem] leading-none text-ink">{title}</h3>
          <button onClick={onClose} className="text-ink-dim hover:text-ink transition-colors p-1" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {children}
        </div>
      </div>
    </div>
  );
}
