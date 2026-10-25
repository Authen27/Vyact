// Q5-001..012 — v10.133.0 (Track Q5; audit FE-UIC-10, FE-UIS-03, FE-UIS-07, INT-HH-13, INT-HH-08, FE-UIC-12,
// FE-MNY-12, FE-MNY-13, FE-SYN-13; owner decisions 20 Oct 2026). App correctness: amounts read as typed, onboarding
// that can run twice, dialogs that keep focus, a household's cache gone with the household, a person's own language,
// one "free to spend", accounts archived at zero, a card in credit, and the dead import gone.
import 'fake-indexeddb/auto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { parseAmount, parseRate } from '../amountInput';
import { onboardingScheduleId, wireOnboardingToMoney } from '../onboardingWiring';
import { trapFocus, trapTabTarget, type TrapDocument } from '../focusTrap';
import { accountsSummary, archiveBlockedByBalance } from '../accountsView';
import { computeAccountBalance, reconcileAccount } from '../accountBalance';
import { cardDues, computeNetWorth } from '../netWorth';
import { buildSafeSummary } from '../aiSummary';
import { profileFromRows } from '../supabaseAdapter';
import { can } from '../permissions';
import { isHouseholdKey, purgeHouseholdCache } from '../cacheInvalidation';
import { kvGet, kvSet } from '../kvStore';
import { ASSET_TYPES } from '../../constants';
import type { Account, Asset, Profile, RecurringSchedule } from '../../types';

const src = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const repo = (p: string) => new URL(`../../../../${p}`, import.meta.url);

describe('amounts read as typed (FE-UIC-10)', () => {
  it('Q5-001 · the last separator with one or two digits is the decimal mark; three digits are grouping; anything else is not an amount', () => {
    const cases: [string, number][] = [
      ['12,50', 12.5], ['12,5', 12.5], ['1.234,56', 1234.56], ['1,234.56', 1234.56], ['1.234', 1234], ['1,234', 1234],
      ['150,000', 150000], ['1,50,000', 150000], ['12,34,567.89', 1234567.89], ['12.345.678,9', 12345678.9],
      ['1 234,56', 1234.56], ['1 234,56', 1234.56], ["1'234.56", 1234.56], ['46.', 46], ['0,5', 0.5], ['.5', 0.5],
      ['0.125', 0.13], ['1.2345', 1.23], ['-1200', -1200], ['-1.234,56', -1234.56], ['999', 999],
    ];
    for (const [raw, want] of cases) expect(parseAmount(raw), raw).toBe(want);
    for (const raw of ['', 'abc', '1,234,56', '1.234,567', '1234,567', '1,5,000', '12,,50', ',', '1.2.3', '₹500'])
      expect(parseAmount(raw), raw).toBeNaN();
    // A rate keeps its precision and never groups: 8.125 % is not 8,125 %.
    expect(parseRate('8.125')).toBe(8.125);
    expect(parseRate('8,5')).toBe(8.5);
    expect(parseRate('10')).toBe(10);
    for (const raw of ['', '1.234,5', '8%', 'x']) expect(parseRate(raw), raw).toBeNaN();
  });

  it('Q5-002 · every typed amount goes through parseAmount, an interest rate through parseRate', () => {
    for (const f of ['components/assets/AssetFormModal.tsx', 'components/budgets/BudgetFormModal.tsx', 'components/debts/DebtFormModal.tsx',
      'components/splits/SplitFormModal.tsx', 'components/transactions/AccountDrawer.tsx', 'pages/Settings.tsx']) {
      expect(src(f), f).not.toMatch(/parseFloat\(/);
    }
    const debt = src('components/debts/DebtFormModal.tsx');
    expect(debt).toMatch(/const rate = parseRate\(form\.interestRate\);/);
    expect(debt).toMatch(/r = parseRate\(form\.interestRate\)/);
    expect(debt).not.toMatch(/Number\(form\.(principal|interestRate|emi|outstanding)\)/);
  });
});

describe('onboarding can run twice (FE-UIS-03)', () => {
  it('Q5-003 · a re-run updates the schedules the last run made, keeps their dates, and never adds a second', async () => {
    const store = new Map<string, RecurringSchedule>();
    let cash: Account = { id: 'cash-1', name: 'Cash', kind: 'cash', currency: 'INR', openingBalance: 0 };
    const fns = {
      getSchedule: (id: string) => store.get(id),
      ensureDefaultCashAccount: vi.fn().mockResolvedValue(undefined),
      getCashAccount: () => cash,
      upsertAccount: vi.fn(async (a: Partial<Account>) => (cash = { ...cash, ...a })),
      upsertRecurring: vi.fn(async (s: Partial<RecurringSchedule>) => { store.set(s.id!, s as RecurringSchedule); return s as RecurringSchedule; }),
      saveOnboardingBudget: vi.fn().mockResolvedValue(undefined),
    };
    const run = (rent: number, now: string) => wireOnboardingToMoney({ householdId: 'h1', monthlyIncome: 50000, currency: 'INR', fns, now: new Date(now),
      bills: [{ key: 'rent', label: 'Rent', amount: rent }, { key: 'internet', label: 'Internet', amount: 800 }] });
    await run(15000, '2026-10-05T10:00:00Z');
    expect([...store.keys()].sort()).toEqual([onboardingScheduleId('h1', 'bill:internet'), onboardingScheduleId('h1', 'bill:rent'),
      onboardingScheduleId('h1', 'paycheck')].sort());
    const rentId = onboardingScheduleId('h1', 'bill:rent');
    // The first rent posted; then setup is run again a month later with a new figure.
    store.set(rentId, { ...store.get(rentId)!, lastGenerated: '2026-11-02', nextDueDate: '2026-12-02' });
    await run(16000, '2026-11-20T10:00:00Z');
    expect(store.size).toBe(3);
    expect(store.get(rentId)).toMatchObject({ nextDueDate: '2026-12-02', lastGenerated: '2026-11-02',
      transactionTemplate: expect.objectContaining({ amount: 16000, description: 'Rent', category: 'rent_mortgage' }) });
    // Another household's ids never collide with this one's.
    expect(onboardingScheduleId('h2', 'bill:rent')).not.toBe(rentId);
    expect(src('pages/Onboarding.tsx')).toMatch(/householdId,\n\s+fns: \{\n.*\n\s+getSchedule: \(id\) => useStore\.getState\(\)\.recurringSchedules\.find\(s => s\.id === id\),/);
  });
});

describe('dialogs keep focus (FE-UIS-07)', () => {
  it('Q5-004 · every dialog of the app frame traps focus and returns it; none pulls Radix into the first paint', () => {
    // The header's sheet, the palette and the desktop account menu load with the first paint: the small shared trap,
    // not Radix (37 KB over the entry budget).
    const traps: [string, RegExp][] = [
      ['components/ui/PullDownSheet.tsx', /useFocusTrap\(dialogRef, open\);/],
      ['components/layout/CommandPalette.tsx', /useFocusTrap\(dialogRef, open\);/],
      ['components/layout/AccountMenu.tsx', /useFocusTrap\(dropdownRef, open && trigger === 'pill'\);/],
      ['components/auth/PolicyUpdateSheet.tsx', /useFocusTrap\(dialogRef\);/],
      ['components/insights/ForYouReel.tsx', /useFocusTrap\(dialogRef\);/],
      ['components/insights/EvergreenReel.tsx', /useFocusTrap\(dialogRef\);/],
    ];
    for (const [f, re] of traps) {
      const s = src(f);
      expect(s, f).toMatch(re);
      expect(s, f).toMatch(/ref=\{(dialogRef|dropdownRef)\} tabIndex=\{-1\}/);
      expect(s, f).not.toMatch(/@radix-ui\/react-dialog/);
    }
    // The desktop account menu closes on Escape, as the sheets do.
    expect(src('components/layout/AccountMenu.tsx')).toMatch(/if \(e\.key === 'Escape'\) setOpen\(false\);/);
    // Every hand-written MODAL (aria-modal="true") in the app is one of these; the rest are Radix ones (AccessibleDialog),
    // so a new modal either traps focus or this fails.
    const walk = (dir: URL): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(e =>
      e.isDirectory() ? walk(new URL(`${e.name}/`, dir)) : e.name.endsWith('.tsx') ? [new URL(e.name, dir).pathname] : []);
    const root = new URL('../../', import.meta.url);
    const handWritten = [...walk(new URL('components/', root)), ...walk(new URL('pages/', root))]
      .filter(p => /\saria-modal="true"/.test(readFileSync(decodeURIComponent(p.replace(/^\/([A-Za-z]:)/, '$1')), 'utf8')))
      .map(p => decodeURIComponent(p).replace(/^.*\/react\/src\//, ''));
    expect(handWritten.length).toBeGreaterThanOrEqual(5);
    expect(handWritten.filter(f => !traps.some(([t]) => t === f))).toEqual([]);
    // The trap itself, on stand-ins: focus moves in, Tab wraps at the end, and the release returns focus to the opener.
    const focused: string[] = [];
    let listener: ((e: KeyboardEvent) => void) | null = null;
    const doc: TrapDocument = {
      activeElement: null,
      addEventListener: (_t, l) => { listener = l; },
      removeEventListener: () => { listener = null; },
    };
    const el = (name: string) => {
      const node = { name, isConnected: true, focus: () => { doc.activeElement = node as unknown as Element; focused.push(name); } };
      return node;
    };
    const opener = el('opener'); const first = el('first'); const last = el('last');
    doc.activeElement = opener as unknown as Element;
    const box = { contains: (x: unknown) => x === first || x === last, querySelectorAll: () => [first, last], focus: () => {} } as unknown as HTMLElement;
    const release = trapFocus(box, doc);
    expect(focused).toEqual(['first']);
    doc.activeElement = last as unknown as Element;
    let prevented = false;
    listener!({ key: 'Tab', shiftKey: false, preventDefault: () => { prevented = true; } } as unknown as KeyboardEvent);
    expect(prevented).toBe(true);
    expect(focused.at(-1)).toBe('first');
    release();
    expect(listener).toBeNull();
    expect(focused.at(-1)).toBe('opener');
    // Tab from the last control goes to the first, Shift+Tab from the first to the last; from outside, in.
    expect(trapTabTarget(3, 2, false)).toBe(0);
    expect(trapTabTarget(3, 0, true)).toBe(2);
    expect(trapTabTarget(3, 1, false)).toBeNull();
    expect(trapTabTarget(3, -1, false)).toBe(0);
    expect(trapTabTarget(3, -1, true)).toBe(2);
    expect(trapTabTarget(0, -1, false)).toBeNull();
  });
});

describe('one "free to spend" (FE-UIC-12, FE-MNY-12)', () => {
  const acct = (p: Partial<Account>): Account => ({ id: crypto.randomUUID(), name: 'a', kind: 'bank', currency: 'INR', openingBalance: 0, ...p }) as Account;
  const bank = acct({ name: 'HDFC', openingBalance: 120000 });
  const cash = acct({ name: 'Cash', kind: 'cash', openingBalance: 3000 });
  const oldBank = acct({ name: 'Old savings', openingBalance: 9000, isArchived: true });
  const card = acct({ name: 'Regalia', kind: 'credit_card', openingBalance: -18000 });
  const oldCard = acct({ name: 'Old card', kind: 'credit_card', openingBalance: -500, isArchived: true });
  const overpaid = acct({ name: 'Overpaid', kind: 'credit_card', openingBalance: 700 });
  const loan = acct({ name: 'Car', kind: 'loan', openingBalance: -400000 });
  const accounts = [bank, cash, oldBank, card, oldCard, overpaid, loan];
  const flat: Asset = { id: 'flat', name: 'Flat', type: 'real_estate', value: 5000000, currency: 'INR', liquidity: 'long' } as Asset;

  it('Q5-005 · Accounts, Net Worth and Pip say the same free-to-spend, archived accounts included', () => {
    const balance = (a: Account) => computeAccountBalance(a, [], 'INR', {});
    const summary = accountsSummary(accounts, balance);
    const projection = computeNetWorth({ assets: [flat], accounts, debts: [], transactions: [] }, 'INR', {});
    const pip = buildSafeSummary([], [], [], [], [flat], { baseCurrency: 'INR' } as Profile, {}, accounts);
    // 120,000 + 3,000 + 9,000 held; 18,000 + 500 owed; the overpaid card and the loan are neither.
    expect(summary).toEqual({ cashAvailable: 132000, cardOutstanding: 18500, spendableNow: 113500, archivedHeld: 9000, archivedOwed: 500 });
    expect(round2(projection.liquidAssets - cardDues(projection))).toBe(summary.spendableNow);
    expect(round2(pip.netWorth.liquidAssets - pip.netWorth.cardDues)).toBe(summary.spendableNow);
    expect(src('pages/Accounts.tsx')).toMatch(/summary: accountsSummary\(onScreen, a => balances\.get\(a\.id\) \?\? 0\),/);
  });

  it('Q5-006 · Net Worth no longer offers cash, checking or savings as an asset type', () => {
    const form = src('components/assets/AssetFormModal.tsx');
    expect(form).toMatch(/\.filter\(\(\[k\]\) => !\(BANK_ASSET_TYPES as readonly string\[\]\)\.includes\(k\) \|\| k === current\);/);
    expect(form).toMatch(/\{OFFERED\(initial\?\.type\)\.map\(/);
    expect(form).toMatch(/type: 'investment',/);
    expect(form).toMatch(/Money in a bank account or in cash belongs in Accounts/);
    // A stored asset of those types still shows (the table keeps them).
    for (const k of ['cash', 'checking', 'savings']) expect(ASSET_TYPES[k], k).toBeDefined();
  });

  it('Q5-007 · an account that holds money or owes cannot be archived; the app says why before writing', () => {
    expect(archiveBlockedByBalance(oldBank, 9000, 'INR')).toMatch(/^Old savings still holds ₹9,000\. An account is archived at zero/);
    expect(archiveBlockedByBalance(card, -18000, 'INR')).toMatch(/^Regalia still owes ₹18,000\./);
    expect(archiveBlockedByBalance(bank, 0.001, 'INR')).toBeNull();
    expect(archiveBlockedByBalance(loan, -400000, 'INR')).toBeNull();   // the loan functions archive a loan's account
    expect(archiveBlockedByBalance(cash, 3000, 'INR')).toBeNull();      // never archived at all (its own guard)
    const crud = src('store/slices/crudSlice.ts');
    expect(crud).toMatch(/if \(existing && a\.isArchived === true && !existing\.isArchived\) \{\n\s+const \{ transactions, rates, profile \} = get\(\);\n\s+const blocked = archiveBlockedByBalance\(merged as Account,/);
    expect(src('components/accounts/DeleteAccountSheet.tsx')).toMatch(/const archiveBlocked = loansBlockArchive \|\| !!balanceBlock;/);
  });

  it('Q5-008 · a card reconciled "in credit" holds the credit: outstanding 0, short, never liquid; "I owe" is unchanged (INV-11)', () => {
    const c = acct({ kind: 'credit_card', name: 'Card', openingBalance: -1500 });
    const credit = reconcileAccount(c, -1500, 2000, 'credit_card', { cardInCredit: true });
    const after = { ...c, ...credit.patch } as Account;
    expect(computeAccountBalance(after, [], 'INR', {})).toBe(2000);
    const projection = computeNetWorth({ assets: [], accounts: [after], debts: [], transactions: [] }, 'INR', {});
    expect(projection.assetRows.find(r => r.id === c.id)).toMatchObject({ value: 2000, liquidity: 'short' });
    expect(cardDues(projection)).toBe(0);
    expect(projection.liquidAssets).toBe(0);
    // Without the choice, a card is stated as what it owes, whatever the sign typed.
    expect(computeAccountBalance({ ...c, ...reconcileAccount(c, -1500, 2000, 'credit_card').patch } as Account, [], 'INR', {})).toBe(-2000);
    const sheet = src('components/accounts/ReconcileSheet.tsx');
    expect(sheet).toMatch(/options=\{\[\{ value: 'owe', label: 'I owe' \}, \{ value: 'credit', label: 'In credit', testId: 'recon-in-credit' \}\]\}/);
    expect(sheet).toMatch(/reconcileAccount\(account, hasDrift \? statedBalance : balance, \{ cardInCredit: isCard && inCredit \}\)/);
  });
});

describe('households (INT-HH-13, INT-HH-08)', () => {
  it('Q5-009 · leaving or deleting a household clears its cache, cursors and copies from the device, and nothing else', async () => {
    const mem = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      get length() { return mem.size; }, key: (i: number) => [...mem.keys()][i] ?? null,
      getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, String(v)); },
      removeItem: (k: string) => { mem.delete(k); }, clear: () => mem.clear(),
    });
    const h1 = crypto.randomUUID();
    const h2 = crypto.randomUUID();
    await kvSet(`${h1}_transactions`, [{ id: 't' }]);
    await kvSet(`chat_history_${h1}`, [{ content: 'private' }]);
    await kvSet(`onboarding_${h1}`, { pay: 1 });
    await kvSet(`${h2}_transactions`, [{ id: 'kept' }]);
    localStorage.setItem(`vt_cursor_${h1}_transactions`, '2026-10-01');
    localStorage.setItem(`vt_cursor_${h2}_transactions`, '2026-10-01');
    localStorage.setItem('vt_sync_queue', '[{"op":"kept"}]');
    expect(await purgeHouseholdCache(h1)).toBeGreaterThanOrEqual(4);
    expect(await kvGet(`${h1}_transactions`)).toBeNull();
    expect(await kvGet(`chat_history_${h1}`)).toBeNull();
    expect(await kvGet(`onboarding_${h1}`)).toBeNull();
    expect(localStorage.getItem(`vt_cursor_${h1}_transactions`)).toBeNull();
    expect(await kvGet(`${h2}_transactions`)).toEqual([{ id: 'kept' }]);
    expect(localStorage.getItem(`vt_cursor_${h2}_transactions`)).toBe('2026-10-01');
    expect(localStorage.getItem('vt_sync_queue')).toBe('[{"op":"kept"}]');
    expect(isHouseholdKey('sync_queue', h1)).toBe(false);
    expect(await purgeHouseholdCache('local')).toBe(0);
    const page = src('pages/Households.tsx');
    expect(page).toMatch(/await purgeHouseholdCache\(h\.id\);\n\s+const next = nextHouseholdAfterExit\(useStore\.getState\(\)\.households, h\.id\);\n\s+if \(h\.id === currentHouseholdId\) await switchHousehold\(next \?\? 'local'\);/);
    expect(src('store/slices/dataSlice.ts')).toMatch(/await purgeHouseholdCache\(id\);\n\s+if \(id === currentHouseholdId\) await get\(\)\.switchHousehold\(/);
    vi.unstubAllGlobals();
  });

  it('Q5-010 · a person\'s language is theirs (the household\'s until they pick one); the household\'s settings are the owner\'s', () => {
    const rows = (prof: string | null, hh: string | null) => profileFromRows({ display_name: 'A', language: prof }, { language: hh }, 'a@b.co').language;
    expect(rows('hi', 'en')).toBe('hi');
    expect(rows(null, 'ta')).toBe('ta');
    expect(rows(null, null)).toBe('en');
    const adapter = src('lib/supabaseAdapter.ts');
    expect(adapter).toMatch(/if \(patch\.language {4}!== undefined\) userPatch\.language = patch\.language;/);
    expect(adapter).not.toMatch(/hhPatch\.language/);
    expect(src('pages/Settings.tsx')).toMatch(/<Select id="settings-language" value=\{profile\.language\}\n\s+onChange=/);
    // Admins no longer get controls the database refuses them ("owners update household").
    expect(can('owner', 'edit_household_settings')).toBe(true);
    for (const r of ['admin', 'member', 'viewer'] as const) expect(can(r, 'edit_household_settings'), r).toBe(false);
    expect(src('pages/Households.tsx')).toMatch(/\{!can\(myRole, 'edit_household_settings'\) && \(\n\s+<p className="[^"]+">Only the household owner can change this\.<\/p>/);
  });
});

describe('the dead import is gone (FE-SYN-13)', () => {
  it('Q5-011 · lib/migration.ts and its call are deleted; the sign-in purge is the only thing that meets anonymous data', () => {
    expect(existsSync(repo('react/src/lib/migration.ts'))).toBe(false);
    const data = src('store/slices/dataSlice.ts');
    expect(data).not.toMatch(/autoMigrateAnonToHousehold|lib\/migration'/);
  });
});

function round2(n: number) { return Math.round(n * 100) / 100; }
