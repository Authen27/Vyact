import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { shortcutAllowed } from '../shortcuts';

describe('single-key shortcuts (W6, audit FE-UIS-10)', () => {
  const page = { tagName: 'BODY' };

  it('W6-UIS10-001 · a bare key (or Shift) acts; Ctrl, Cmd, Alt and IME composition never do', () => {
    expect(shortcutAllowed({ key: 'a' }, page, false)).toBe(true);
    expect(shortcutAllowed({ key: 'N' }, page, false)).toBe(true);          // Shift+n
    expect(shortcutAllowed({ key: 'a', metaKey: true }, page, false)).toBe(false);   // Cmd+A = select all
    expect(shortcutAllowed({ key: 'd', ctrlKey: true }, page, false)).toBe(false);   // Ctrl+D = bookmark
    expect(shortcutAllowed({ key: 'b', altKey: true }, page, false)).toBe(false);
    expect(shortcutAllowed({ key: 'n', isComposing: true }, page, false)).toBe(false);
  });

  it('W6-UIS10-002 · never in a form field, an editable element, or while a dialog is open', () => {
    expect(shortcutAllowed({ key: 'n' }, { tagName: 'INPUT' }, false)).toBe(false);
    expect(shortcutAllowed({ key: 'n' }, { tagName: 'textarea' }, false)).toBe(false);
    expect(shortcutAllowed({ key: 'n' }, { tagName: 'DIV', isContentEditable: true }, false)).toBe(false);
    expect(shortcutAllowed({ key: 'n' }, { tagName: 'BUTTON' }, true)).toBe(false);   // bell / palette open
    expect(shortcutAllowed({ key: 'n' }, null, false)).toBe(true);
  });

  it('W6-UIS10-003 · useShortcuts consults the rule and adds its listener once', () => {
    const src = readFileSync(resolve(__dirname, '../../hooks.ts'), 'utf8');
    const hook = src.slice(src.indexOf('export function useShortcuts'));
    expect(hook).toMatch(/shortcutAllowed\(e, focused, dialogOpen\)/);
    expect(hook).toMatch(/handlersRef\.current\[e\.key\]/);
    expect(hook).toMatch(/\}, \[\]\);/);
  });
});
