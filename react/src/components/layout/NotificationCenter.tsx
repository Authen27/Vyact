import { useState, useRef, useEffect } from 'react';
import { Bell, Check, X } from 'lucide-react';
import { useStore } from '../../store';
import type { NotifType } from '../../types';

const TYPE_LABEL: Record<NotifType, string> = {
  upcoming_bill:    'Upcoming bill',
  missed_payment:   'Missed payment',
  budget_threshold: 'Budget',
  goal_milestone:   'Goal milestone',
  weekly_digest:    'Weekly digest',
  custom_reminder:  'Reminder',
};

const TYPE_DOT: Record<NotifType, string> = {
  upcoming_bill:    'bg-honey',
  missed_payment:   'bg-terra',
  budget_threshold: 'bg-coral',
  goal_milestone:   'bg-sage',
  weekly_digest:    'bg-denim',
  custom_reminder:  'bg-plum',
};

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const notifications = useStore(s => s.notifications);
  const markRead = useStore(s => s.markNotificationRead);
  const dismiss = useStore(s => s.dismissNotification);

  const active = notifications.filter(n => n.status !== 'dismissed');
  const unreadCount = active.filter(n => n.status === 'unread').length;

  useEffect(() => {
    const onClickAway = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-md text-ink-mid hover:text-ink hover:bg-bg3 transition-colors"
        title="Notifications"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 bg-coral text-white text-[0.55rem] font-mono font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 z-50 w-80 mt-1 bg-bg2 border border-line2 rounded-md shadow-2 max-h-[28rem] overflow-y-auto">
          <div className="px-3 py-2.5 border-b border-line flex justify-between items-center sticky top-0 bg-bg2">
            <span className="font-mono text-[0.6rem] tracking-[0.14em] uppercase text-ink-mid font-medium">
              Notifications {unreadCount > 0 && `· ${unreadCount} unread`}
            </span>
          </div>

          {active.length === 0 ? (
            <div className="text-center py-10 text-ink-dim font-mono text-[0.62rem] tracking-wider uppercase">
              All clear · Nothing new
            </div>
          ) : (
            <div className="divide-y divide-line">
              {active.map(n => (
                <div
                  key={n.id}
                  className={`px-3 py-2.5 flex items-start gap-2.5 group ${n.status === 'unread' ? 'bg-coral-tint/40' : ''}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${TYPE_DOT[n.type]}`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-[0.55rem] tracking-[0.1em] uppercase text-ink-dim mb-0.5">
                      {TYPE_LABEL[n.type]}
                    </div>
                    <div className="text-[0.84rem] font-semibold text-ink leading-snug">{n.title}</div>
                    <div className="text-[0.78rem] text-ink-mid leading-snug mt-0.5">{n.body}</div>
                  </div>
                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100">
                    {n.status === 'unread' && (
                      <button onClick={() => markRead(n.id)} className="p-1 hover:text-sage" title="Mark read">
                        <Check size={12} />
                      </button>
                    )}
                    <button onClick={() => dismiss(n.id)} className="p-1 hover:text-terra" title="Dismiss">
                      <X size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
