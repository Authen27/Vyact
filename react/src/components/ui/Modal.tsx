import { type ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export default function Modal({ open, title, onClose, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-5"
      style={{ background: 'hsl(var(--shadow) / 0.55)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-bg2 border border-line2 rounded-lg w-full max-w-md max-h-[92vh] overflow-y-auto shadow-3 animate-modalIn">
        <div className="flex justify-between items-center px-5 py-4 border-b border-line">
          <h3 className="display-italic text-[1.5rem] leading-none text-ink">{title}</h3>
          <button onClick={onClose} className="text-ink-dim hover:text-ink transition-colors p-1">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
