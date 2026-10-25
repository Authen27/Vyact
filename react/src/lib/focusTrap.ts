// Vyact — the focus rules for a full-screen dialog of our own (v10.133.0, Track Q5; audit FE-UIS-07).
//
// Form sheets render through Radix Dialog (AccessibleDialog). The dialogs of the app's frame cannot: the header's
// PullDownSheet (notifications, the household switcher, the phone's account menu), the ⌘K palette and the desktop
// account menu load with the first paint, where Radix would cost 37 KB of its 350 KB budget; the policy sheet AuthGate
// shows before the app is rendered to static markup in its tests; and the two story reels (Insights) scroll under
// their own gestures. They were role="dialog" divs, so Tab walked out of them into the page behind. useFocusTrap gives
// them the same rules while they are open:
//   • focus starts inside (the dialog's own choice, else its first control);
//   • Tab and Shift+Tab cycle inside it;
//   • when it closes, focus returns to what had it before.
import { useEffect, type RefObject } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), '
  + 'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Where Tab should go inside a dialog of `count` controls, with focus on control `current` (−1 when focus is outside
 * the dialog). Null means "let the browser move it" (a step that stays inside). Pure, for the tests.
 */
export function trapTabTarget(count: number, current: number, shift: boolean): number | null {
  if (count === 0) return null;
  if (current < 0) return shift ? count - 1 : 0;
  if (shift && current === 0) return count - 1;
  if (!shift && current === count - 1) return 0;
  return null;
}

/** The parts of the document the trap uses (the tests pass a stand-in). */
export interface TrapDocument {
  activeElement: Element | null;
  addEventListener(type: 'keydown', listener: (e: KeyboardEvent) => void, capture: boolean): void;
  removeEventListener(type: 'keydown', listener: (e: KeyboardEvent) => void, capture: boolean): void;
}

/** Traps focus in `root` until the returned release is called, which returns focus to what had it before. */
export function trapFocus(root: HTMLElement, doc: TrapDocument = document): () => void {
  const before = doc.activeElement as HTMLElement | null;
  const controls = () => Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
  if (!root.contains(doc.activeElement)) (controls()[0] ?? root).focus();
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const items = controls();
    const target = trapTabTarget(items.length, items.indexOf(doc.activeElement as HTMLElement), e.shiftKey);
    if (items.length === 0) { e.preventDefault(); return; }
    if (target !== null) { e.preventDefault(); items[target].focus(); }
  };
  doc.addEventListener('keydown', onKey, true);
  return () => {
    doc.removeEventListener('keydown', onKey, true);
    if (before?.isConnected && typeof before.focus === 'function') before.focus();
  };
}

export function useFocusTrap(ref: RefObject<HTMLElement | null>, active = true): void {
  useEffect(() => {
    if (!active || !ref.current) return;
    return trapFocus(ref.current);
  }, [ref, active]);
}
