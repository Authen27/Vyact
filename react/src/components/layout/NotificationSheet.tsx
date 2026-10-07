// Aurora notification pull-down (v10.1 · notifications-spec.md).
// Full-screen glass sheet drawn from the top (mobile + desktop 720px column),
// grouped Today / Earlier, P1 pinned first, coral unread dots, per-type inline
// decisions. Actions that resolve in place (approve / skip / dismiss) flip the
// row to read and keep the sheet open; navigation actions apply context and
// leave. Replaces the old anchored popover.
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store';
import PullDownSheet from '../ui/PullDownSheet';
import PhonePushPrompt from './PhonePushPrompt';
import { Pip } from './Brand';
import { NOTIF_META, notificationOccurrence } from '../../lib/notifications';
import type { Notification, NotifActionSpec } from '../../types';

const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

function ActionButton({ spec, onClick }: { spec: NotifActionSpec; onClick: () => void }) {
  const cls = spec.kind === 'primary' ? 'btn-primary btn-sm'
    : spec.kind === 'neu' ? 'btn-secondary btn-sm'
    : 'btn-ghost btn-sm';
  return (
    <button className={cls} onClick={e => { e.stopPropagation(); onClick(); }}>{spec.label}</button>
  );
}

export default function NotificationSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const notifications = useStore(s => s.notifications);
  const currentHouseholdId = useStore(s => s.currentHouseholdId);
  const households = useStore(s => s.households);
  const recurringSchedules = useStore(s => s.recurringSchedules);
  const markRead = useStore(s => s.markNotificationRead);
  const markAllRead = useStore(s => s.markAllNotificationsRead);
  const dismiss = useStore(s => s.dismissNotification);
  const approveRecurring = useStore(s => s.approveRecurring);
  const skipRecurring = useStore(s => s.skipRecurring);
  const debts = useStore(s => s.debts);
  const toast = useStore(s => s.toast);

  const householdName = households.find(h => h.id === currentHouseholdId)?.name || 'This household';

  const { today, earlier, unread } = useMemo(() => {
    const active = notifications
      .filter(n => n.status !== 'dismissed' && (!n.householdId || n.householdId === currentHouseholdId))
      // P1 (action-required) pinned first, then newest first.
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority === 'P1' ? -1 : 1;
        return b.createdAt.localeCompare(a.createdAt);
      });
    return {
      today: active.filter(n => isToday(n.createdAt)),
      earlier: active.filter(n => !isToday(n.createdAt)),
      unread: active.filter(n => n.status === 'unread').length,
    };
  }, [notifications, currentHouseholdId]);

  function runAction(n: Notification, actionId: string) {
    switch (actionId) {
      // W4d (audit FE-UIS-04) — both act on THE CARD'S occurrence only, and only while it is the one
      // due. A card for a bill already handled elsewhere says so, instead of skipping next month's bill
      // or claiming a post that never happened.
      case 'approve': {   // recurring_due_confirm — post the txn, advance, stay open
        const s = recurringSchedules.find(x => x.id === n.scheduleId);
        const occurrence = notificationOccurrence(n) ?? s?.nextDueDate;
        if (!s || !occurrence) { markRead(n.id); toast('Already handled', 'info'); return; }
        void approveRecurring(s.id, occurrence).then(posted => {
          markRead(n.id);
          toast(posted ? 'Approved — transaction posted' : 'Already handled', posted ? 'success' : 'info');
        }).catch(() => toast('Could not approve this bill. Please retry.', 'error'));
        return;
      }
      case 'skip': {      // skip this occurrence: advance without posting, stay open
        const s = recurringSchedules.find(x => x.id === n.scheduleId);
        const occurrence = notificationOccurrence(n) ?? s?.nextDueDate;
        if (!s || !occurrence) { markRead(n.id); toast('Already handled', 'info'); return; }
        void skipRecurring(s.id, occurrence).then(skipped => {
          markRead(n.id);
          toast(skipped ? 'Skipped once' : 'Already handled', 'info');
        }).catch(() => toast('Could not skip this bill. Please retry.', 'error'));
        return;
      }
      case 'dismiss':
        dismiss(n.id);
        return;
      case 'record': {    // debt_payment_due — W4f (D19): the loan's own Pay sheet, prefilled with the EMI due
        // (it used to seed a plain expense with no category, which landed in Food & Dining).
        const d = debts.find(x => x.id === n.debtId);
        markRead(n.id);
        onClose();
        navigate(d ? `/debts?pay=${d.id}` : '/debts');
        return;
      }
      default: {          // view / review / edit / see_txns / update → navigate + leave
        markRead(n.id);
        onClose();
        if (n.deepLink) navigate(n.deepLink);
      }
    }
  }

  function onRowTap(n: Notification) {
    // Whole-row tap navigates (P2 + read rows); P1 unread rows use their buttons.
    if (n.status === 'unread' && n.actions?.length) return;
    markRead(n.id);
    onClose();
    if (n.deepLink) navigate(n.deepLink);
  }

  const empty = today.length === 0 && earlier.length === 0;

  const Group = ({ label, rows }: { label: string; rows: Notification[] }) => rows.length ? (
    /* Board M2 — the list is inset so unread dots sit in a gutter left of the
       icon tiles, exactly at the sheet's content edge. */
    <div className="pl-3">
      <div className="mono-label pt-2.5 pb-1">{label}</div>
      {rows.map(n => {
        const meta = NOTIF_META[n.type];
        return (
          <div
            key={n.id}
            onClick={() => onRowTap(n)}
            className={`relative flex items-start gap-3 rounded-r2 px-1 py-3 border-b border-line last:border-0 transition-colors hover:bg-bg3/60 cursor-pointer ${n.status === 'read' ? 'opacity-60' : ''}`}
          >
            {n.status === 'unread' && (
              <span className="absolute -left-3 top-6 w-[7px] h-[7px] rounded-full" style={{ background: 'var(--accent)' }} aria-label="unread" />
            )}
            {/* Board M2 — read rows drop the tint: sunken inset tile. */}
            <span className="w-[38px] h-[38px] rounded-xl flex items-center justify-center flex-shrink-0 text-[16px]"
              style={n.status === 'read'
                ? { background: 'var(--sunken)', boxShadow: 'var(--neu-inset)', color: 'var(--ff-ink-3)' }
                : { background: `color-mix(in srgb, ${n.tint || meta.tint} 16%, transparent)`, color: n.tint || meta.tint }}>
              {meta.icon}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[14px] text-ink leading-snug">{n.title}</div>
              {n.body && <div className="text-[12px] text-ink-dim mt-0.5">{n.body}</div>}
              {n.status === 'unread' && n.actions?.length ? (
                <div className="flex flex-wrap gap-2 mt-2">
                  {n.actions.map(a => <ActionButton key={a.id} spec={a} onClick={() => runAction(n, a.id)} />)}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  ) : null;

  return (
    <PullDownSheet
      open={open}
      onClose={onClose}
      ariaLabel="Notifications"
      header={
        <div className="flex items-center justify-between pt-6 pb-1">
          <div>
            <h2 className="font-display text-2xl font-bold text-ink leading-none tracking-tight">Notifications</h2>
            <div className="mono-label mt-1.5">{unread} unread · {householdName}</div>
          </div>
          {unread > 0 && (
            <button className="btn-ghost btn-sm" style={{ color: 'var(--accent)' }} onClick={markAllRead}>Mark all read</button>
          )}
        </div>
      }
      footer={
        <button
          className="w-full text-center mono-label py-1.5"
          style={{ color: 'var(--accent)' }}
          onClick={() => { onClose(); navigate('/settings#notifications'); }}
        >
          Notification settings →
        </button>
      }
    >
      <PhonePushPrompt />
      {empty ? (
        <div className="flex flex-col items-center justify-center text-center py-16 gap-3">
          <Pip size={52} />
          <div className="font-display text-lg font-semibold text-ink">All caught up</div>
          <p className="text-[0.85rem] text-ink-dim max-w-[240px]">Nothing needs you right now. We'll nudge you when something does.</p>
        </div>
      ) : (
        <>
          <Group label="Today" rows={today} />
          <Group label="Earlier" rows={earlier} />
        </>
      )}
    </PullDownSheet>
  );
}
