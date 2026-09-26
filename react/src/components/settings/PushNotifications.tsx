// Settings › Notifications › Push on this device (v10.48.0, TD-22).
//
// Cloud mode: real Web Push. The device subscribes with its push service and is
// registered with Vyact; the server raises and pushes, so alerts reach the lock screen
// with the app closed. "Send a test" proves the whole path on THIS device and shows
// what the push service answered.
// Local-only mode keeps the old behaviour: a popup from the open app only.
import { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { requestWebPushPermission } from '../../lib/notifications';
import {
  pushBlocker, enablePush, disablePush, sendTestPush, devicePushStatus, type DeviceStatus, type EnableResult,
} from '../../lib/webPush';
import { forceReloadForUpdate } from '../../lib/pwa';

const REFUSED: Record<Exclude<EnableResult, { ok: true }>['reason'], string> = {
  ios_not_installed: 'On iPhone, add Vyact to your Home Screen first (Share → Add to Home Screen), open it from there, then turn this on.',
  unsupported: "This browser can't receive push notifications.",
  denied: "Notifications are blocked for Vyact. Allow them in your phone's (or browser's) settings, then turn this on again.",
  update_needed: 'Vyact needs to update before it can receive notifications. Reload, then turn this on again.',
  server: "This device couldn't be registered. Please try again in a moment.",
};

const TEST_ERRORS: Record<string, string> = {
  too_many_tests: 'Too many tests in a row. Try again in 10 minutes.',
  no_devices: "This device isn't registered any more. Turn push off and on again.",
};

function when(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function PushNotifications() {
  const cloudEnabled = useStore(s => s.cloudEnabled);
  const session = useStore(s => s.session);
  const householdId = useStore(s => s.currentHouseholdId);
  const prefs = useStore(s => s.notificationPrefs);
  const updatePrefs = useStore(s => s.updateNotificationPrefs);
  const toast = useStore(s => s.toast);
  const cloud = cloudEnabled && !!session && !!householdId && householdId !== 'local';

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [testNote, setTestNote] = useState<string | null>(null);
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const blocker = pushBlocker();

  useEffect(() => {
    if (cloud && prefs.webPushEnabled) void devicePushStatus().then(setStatus);
  }, [cloud, prefs.webPushEnabled]);

  async function toggle(on: boolean) {
    if (!cloud) {
      if (on && !(await requestWebPushPermission())) {
        toast('Enable notifications for Vyact in your browser settings first', 'error');
        return;
      }
      updatePrefs({ webPushEnabled: on });
      return;
    }
    setBusy(true);
    setTestNote(null);
    try {
      if (on) {
        // Straight from the tap: iOS only prompts from a user gesture.
        const r = await enablePush(householdId!, { ...prefs, webPushEnabled: true });
        if (!r.ok) {
          setNeedsUpdate(r.reason === 'update_needed');
          toast(REFUSED[r.reason], 'error');
          return;
        }
        updatePrefs({ webPushEnabled: true });
        setStatus(await devicePushStatus());
        toast('Push notifications are on for this device', 'success');
      } else {
        await disablePush();
        updatePrefs({ webPushEnabled: false });
        setStatus(null);
      }
    } finally {
      setBusy(false);
    }
  }

  async function runTest() {
    setBusy(true);
    setTestNote(null);
    try {
      const r = await sendTestPush();
      if (!r.ok) { setTestNote(TEST_ERRORS[r.error] ?? "The test couldn't be sent. Please try again."); return; }
      const mine = r.results[0];
      if (!mine) setTestNote("This device isn't registered any more. Turn push off and on again.");
      else if (mine.accepted) setTestNote(`Sent. The push service accepted it (${mine.status}); it should appear on this device within a few seconds, even with Vyact closed.`);
      else if (mine.gone) setTestNote("This device's subscription has expired. Turn push off and on again.");
      else setTestNote(`The push service refused it (${mine.status}). Turn push off and on again.`);
      setStatus(await devicePushStatus());
    } finally {
      setBusy(false);
    }
  }

  const on = prefs.webPushEnabled;
  return (
    <div className="space-y-2">
      <label className="flex items-center justify-between gap-3 cursor-pointer">
        <div>
          <div className="text-sm font-semibold text-ink">Push notifications on this device</div>
          <div className="text-[0.76rem] text-ink-dim mt-0.5">
            {cloud
              ? 'Bills due, budgets at 80% and balances to check, on your lock screen even when Vyact is closed. Action-required alerts only, never in quiet hours.'
              : 'Show a system notification for action-required alerts while Vyact is open.'}
          </div>
        </div>
        <input
          type="checkbox"
          checked={on}
          disabled={busy}
          onChange={e => void toggle(e.target.checked)}
          className="accent-coral w-[18px] h-[18px] flex-shrink-0"
          aria-label="Push notifications on this device"
        />
      </label>

      {cloud && blocker === 'ios_not_installed' && !on && (
        <p className="text-[0.76rem] text-ink-dim">{REFUSED.ios_not_installed}</p>
      )}

      {needsUpdate && (
        <button type="button" className="btn-ghost text-sm" onClick={() => void forceReloadForUpdate()}>Reload to update</button>
      )}

      {cloud && on && (
        <div className="rounded-lg border border-line px-3 py-2.5 space-y-2">
          <div className="text-[0.76rem] text-ink-dim" data-testid="push-status">
            {status?.registered
              ? status.active === false
                ? 'This device stopped accepting notifications. Turn push off and on again.'
                : `Registered on this device${status.last_success_at ? ` · last delivered ${when(status.last_success_at)}` : ''}`
              : 'Not registered on this device yet. Turn push off and on again.'}
          </div>
          <button type="button" className="btn-ghost text-sm" disabled={busy} onClick={() => void runTest()}>
            Send a test notification
          </button>
          {testNote && <p className="text-[0.76rem] text-ink" role="status">{testNote}</p>}
        </div>
      )}
    </div>
  );
}
