import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';

// Aurora 4.0 S2 / DB2 — the ⋯ More menu for a card's rarer actions, so each card keeps one primary
// action (and its common secondary) in view instead of a row of buttons that wraps on phones. A
// `menu` of `menuitem` buttons; Escape and a tap outside close it, and focus returns to the trigger.
export interface OverflowItem {
  label: string;
  onSelect: () => void;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
}

export default function OverflowMenu({ items, label = 'More', ariaLabel, align = 'right' }: {
  items: OverflowItem[];
  label?: string;
  /** Accessible name of the trigger when the visible label is not enough ("More actions for Car loan"). */
  ariaLabel?: string;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    const onDown = (e: MouseEvent) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [open]);

  const shown = items.filter(Boolean);
  if (!shown.length) return null;

  return (
    <div ref={root} className="relative inline-flex">
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={ariaLabel}
        onClick={() => setOpen(o => !o)}
        className="btn-ghost !min-h-[40px] !px-3 inline-flex items-center gap-1.5"
      >
        <MoreHorizontal size={15} aria-hidden /> {label}
      </button>
      {open && (
        <div id={id} role="menu" className={`glass-panel absolute ${align === 'right' ? 'right-0' : 'left-0'} top-[calc(100%+6px)] z-[60] min-w-[190px] rounded-r2 p-1.5 flex flex-col`}>
          {shown.map(item => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => { setOpen(false); item.onSelect(); }}
              className="flex items-center gap-2.5 min-h-[44px] px-3 rounded-r2 text-left text-[14px] hover:bg-bg3 disabled:opacity-40 disabled:cursor-not-allowed"
              style={item.danger ? { color: 'var(--crit-text)' } : { color: 'hsl(var(--ink))' }}
            >
              {item.icon && <span aria-hidden className="flex-shrink-0">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
