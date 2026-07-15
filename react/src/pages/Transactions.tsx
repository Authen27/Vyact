import { useState, useMemo, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CalendarDays, X, Search, SlidersHorizontal, RotateCcw, ChevronDown,
} from 'lucide-react';
import { useStore } from '../store';
import { useTranslation, useShortcuts } from '../hooks';
import { Panel } from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import HalfSheet from '../components/ui/HalfSheet';
import Chip from '../components/ui/Chip';
import TxnRow from '../components/transactions/TxnRow';
import TxnCalendar from '../components/transactions/TxnCalendar';
import SavedViewsBar from '../components/savedViews/SavedViewsBar';
import { ALL_CATEGORIES } from '../constants';
import { getMonthKey, monthName, formatDate, nowMonthKey, today, transactionSortValue, fmt } from '../lib/format';
import { projectRecurringTransactionsForDate } from '../lib/recurring';
import type { Transaction, TxnType } from '../types';

type TransactionListItem = {
  txn: Transaction;
  projected?: boolean;
};

type MonthGroup = {
  key: string;                  // 'YYYY-MM'
  label: string;                // 'May 2026'
  items: TransactionListItem[];
  net: number;                  // income − expense for real (non-projected) rows
};

type TxnFilter = 'all' | TxnType;

// How many month sections a single page reveals (product brief: "recent 3 months
// … paginate to see previous 3 months and so on").
const MONTHS_PER_PAGE = 3;

export default function Transactions() {
  const { t } = useTranslation();
  const txns    = useStore(s => s.transactions);
  const members = useStore(s => s.members);
  const schedules = useStore(s => s.recurringSchedules);
  const profile = useStore(s => s.profile);
  const openAddTxn  = useStore(s => s.openAddTxn);
  const openEditTxn = useStore(s => s.openEditTxn);
  const budgets     = useStore(s => s.budgets);
  const budgetAllocations = useStore(s => s.budgetAllocations);
  const debts       = useStore(s => s.debts);

  // v7.4.4 — deep-link from Dashboard cards (?type=income/expense, ?cat=foo).
  const [searchParams, setSearchParams] = useSearchParams();
  const initialType = (() => {
    const t = searchParams.get('type');
    return t === 'income' || t === 'expense' || t === 'investment' || t === 'transfer' ? t : 'all';
  })();
  const initialCat = searchParams.get('cat') || 'all';

  const [search,   setSearch]   = useState('');
  const [type,     setType]     = useState<TxnFilter>(initialType as TxnFilter);
  const [cat,      setCat]      = useState(initialCat);
  const [month,    setMonth]    = useState('all');
  const [memberId, setMemberId] = useState('all');
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // `/` focuses the search box. The `n` add-transaction shortcut is now
  // registered app-wide in Layout (v7.4.4) so it works on every page.
  useShortcuts({
    '/': () => searchRef.current?.focus(),
  });

  // Strip the legacy ?type/?cat seed params after seeding so a refresh respects
  // user changes — but ONLY when no v9.1 §8 context param is present (budgetId /
  // debtId / month / from / to drive a live context chip and must persist).
  useEffect(() => {
    const hasCtx = ['budgetId','debtId','month','from','to'].some(k => searchParams.get(k));
    if (!hasCtx && (searchParams.get('type') || searchParams.get('cat'))) {
      const next = new URLSearchParams(searchParams);
      next.delete('type'); next.delete('cat');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const months = useMemo(
    () => [...new Set(txns.map(t => getMonthKey(t.date)))].sort().reverse(),
    [txns]
  );

  // v9.1 §8 — unified deep-link context. One contract: budgetId resolves to the
  // budget's period + its allocation categories; debtId resolves to that debt's
  // payments/EMIs (incl. receivable repayments); month / from-to are date ranges.
  const ctx = useMemo(() => {
    const budgetId = searchParams.get('budgetId');
    const debtId = searchParams.get('debtId');
    const monthP = searchParams.get('month');
    let from = searchParams.get('from') || undefined;
    let to = searchParams.get('to') || undefined;
    let cats: Set<string> | null = null;
    let label = '';
    if (budgetId) {
      const b = budgets.find(x => x.id === budgetId);
      if (b) {
        from = b.periodStart; to = b.periodEnd;
        const catParam = searchParams.get('cat');
        const al = budgetAllocations.filter(a => a.budgetId === budgetId);
        cats = new Set(catParam ? [catParam] : al.map(a => a.category));
        const title = b.scope === 'annual' ? `${b.periodYear}`
          : b.periodMonth ? `${b.periodYear}-${String(b.periodMonth).padStart(2,'0')}` : 'budget';
        label = `Budget: ${title}${catParam ? ` · ${catParam}` : ''}`;
      }
    } else if (debtId) {
      label = `Debt: ${debts.find(x => x.id === debtId)?.name ?? 'payments'}`;
    } else if (monthP) {
      from = `${monthP}-01`;
      const [y, m] = monthP.split('-').map(Number);
      to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
      label = `Month: ${monthP}`;
    } else if (from || to) {
      label = `${from ?? '…'} → ${to ?? '…'}`;
    }
    return { budgetId, debtId, from, to, cats, label };
  }, [searchParams, budgets, budgetAllocations, debts]);

  const filtered = useMemo<TransactionListItem[]>(() => {
    let f = [...txns];
    if (selectedDate)       f = f.filter(t => t.date === selectedDate);
    if (type !== 'all')     f = f.filter(t => t.type === type);
    if (cat !== 'all')      f = f.filter(t => t.category === cat);
    if (!selectedDate && month !== 'all') f = f.filter(t => getMonthKey(t.date) === month);
    if (memberId !== 'all') f = f.filter(t => t.memberId === memberId);
    // §8 deep-link context
    if (ctx.from) f = f.filter(t => t.date >= ctx.from!);
    if (ctx.to)   f = f.filter(t => t.date <= ctx.to!);
    if (ctx.cats) f = f.filter(t => ctx.cats!.has(t.category));
    if (ctx.debtId) f = f.filter(t =>
      t.debtId === ctx.debtId || t.emiSplit?.debt_id === ctx.debtId || t.linkedDebtId === ctx.debtId);
    if (search) {
      const q = search.toLowerCase();
      f = f.filter(t =>
        t.description.toLowerCase().includes(q) ||
        (t.note || '').toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    }
    const rows: TransactionListItem[] = f.map(txn => ({ txn }));

    if (selectedDate && selectedDate > today()) {
      const projected = projectRecurringTransactionsForDate(schedules, selectedDate)
        .map<TransactionListItem>(txn => ({
          txn,
          projected: true,
        }))
        .filter(({ txn }) => (type === 'all' ? true : txn.type === type))
        .filter(({ txn }) => (cat === 'all' ? true : txn.category === cat))
        .filter(({ txn }) => (memberId === 'all' ? true : txn.memberId === memberId))
        .filter(({ txn }) => {
          if (!search) return true;
          const q = search.toLowerCase();
          return txn.description.toLowerCase().includes(q)
            || (txn.note || '').toLowerCase().includes(q)
            || txn.category.toLowerCase().includes(q);
        })
        .filter(({ txn }) => !rows.some(existing =>
          existing.txn.date === txn.date
          && existing.txn.description === txn.description
          && existing.txn.category === txn.category
          && existing.txn.type === txn.type
          && existing.txn.amount === txn.amount
        ));

      rows.push(...projected);
    }

    return rows.sort((a, b) => transactionSortValue(b.txn) - transactionSortValue(a.txn) || b.txn.id.localeCompare(a.txn.id));
  }, [txns, schedules, search, type, cat, month, memberId, selectedDate, ctx]);

  // v9.6 — group the (already date-sorted desc) list into month+year sections
  // and reveal them a page at a time. The product brief: a long flat list is
  // hostile; show the most recent months as collapsible accordions and let the
  // user page back through earlier months (MONTHS_PER_PAGE at a time) until the
  // earliest transaction. `filtered` is sorted desc, so first-seen month order
  // is already newest→oldest.
  const monthGroups = useMemo<MonthGroup[]>(() => {
    const map = new Map<string, TransactionListItem[]>();
    for (const item of filtered) {
      const key = getMonthKey(item.txn.date);
      const arr = map.get(key);
      if (arr) arr.push(item);
      else map.set(key, [item]);
    }
    const groups: MonthGroup[] = [];
    for (const [key, items] of map) {
      let net = 0;
      for (const it of items) {
        if (it.projected) continue;
        if (it.txn.type === 'income') net += it.txn.amount;
        else if (it.txn.type === 'expense') net -= it.txn.amount;
      }
      groups.push({ key, label: monthName(key), items, net });
    }
    // Guard against Map insertion order surprises — pin to descending month key.
    groups.sort((a, b) => b.key.localeCompare(a.key));
    return groups;
  }, [filtered]);

  // Pagination — reveal MONTHS_PER_PAGE months, "Load previous" adds another page.
  const [visibleMonths, setVisibleMonths] = useState(MONTHS_PER_PAGE);
  // Any change to the active filter set resets paging to the most recent page so
  // the user isn't stranded deep in history after re-filtering. (We intentionally
  // do NOT reset on raw `txns` changes — a realtime refresh shouldn't snap paging.)
  useEffect(() => {
    setVisibleMonths(MONTHS_PER_PAGE);
  }, [search, type, cat, month, memberId, selectedDate, ctx.label, ctx.from, ctx.to]);

  const visibleGroups = monthGroups.slice(0, visibleMonths);
  const hasMoreMonths = monthGroups.length > visibleMonths;

  // Accordion state — months are expanded by default; this tracks the collapsed
  // set (a tap toggles). Keyed by month so it survives paging/refilter.
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(() => new Set());
  const toggleMonth = (key: string) =>
    setCollapsedMonths(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // Tapping a day filters the list to that date (and reveals the calendar if hidden).
  function handleSelectDate(date: string) {
    setSelectedDate(d => (d === date ? null : date));
  }

  // ---- Filter UX helpers (slim bar) -------------------------------------
  const activeFilters = useMemo(() => {
    const list: { key: string; label: string; clear: () => void }[] = [];
    if (type !== 'all')     list.push({ key: 'type',  label: `Type: ${type}`, clear: () => setType('all') });
    if (cat !== 'all') {
      const c = ALL_CATEGORIES.find(x => x.id === cat);
      list.push({ key: 'cat', label: `Category: ${c ? c.label : cat}`, clear: () => setCat('all') });
    }
    if (month !== 'all')    list.push({ key: 'month', label: `Month: ${monthName(month)}`, clear: () => setMonth('all') });
    if (memberId !== 'all') {
      const m = members.find(x => x.id === memberId);
      list.push({ key: 'member', label: `Member: ${m ? m.name : memberId}`, clear: () => setMemberId('all') });
    }
    // §8 — deep-link context chip (budget / debt / month / range).
    if (ctx.label) list.push({ key: 'ctx', label: ctx.label, clear: () => setSearchParams({}, { replace: true }) });
    return list;
  }, [type, cat, month, memberId, members, ctx, setSearchParams]);
  const hasFilters = activeFilters.length > 0 || search.length > 0 || selectedDate !== null;
  function resetAllFilters() {
    setSearch(''); setType('all'); setCat('all'); setMonth('all'); setMemberId('all'); setSelectedDate(null);
    setSearchParams({}, { replace: true });
  }

  // Net of the *visible* (non-projected) rows so users see the impact of
  // their filter on real data. Income & investment-sell add; expense &
  // investment-buy & transfers do not contribute to net spend.
  const filteredNet = useMemo(() => {
    let net = 0;
    for (const item of filtered) {
      if (item.projected) continue;
      if (item.txn.type === 'income') net += item.txn.amount;
      else if (item.txn.type === 'expense') net -= item.txn.amount;
    }
    return net;
  }, [filtered]);

  return (
    <div>
      <div className="flex justify-between items-start mb-5 gap-4">
        <div className="min-w-0">
          <h1 className="display-italic text-4xl text-ink mb-1.5">{t('transactions')}</h1>
          <p className="font-mono text-[0.6rem] tracking-[0.14em] uppercase text-ink-dim">
            All household income, expenses, investments &amp; transfers
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button className="btn-primary" onClick={() => openAddTxn()}>+ {t('add-transaction')}</button>
        </div>
      </div>

      {/* Batch B — type chip-rail (board M1): the primary filter as neu chips
          instead of a buried dropdown. */}
      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
        {([
          { v: 'all', label: 'All' },
          { v: 'expense', label: '💸 Expense' },
          { v: 'income', label: '💰 Income' },
          { v: 'transfer', label: '🔄 Transfer' },
          { v: 'investment', label: '📈 Investment' },
        ] as { v: TxnFilter; label: string }[]).map(o => (
          <Chip key={o.v} on={type === o.v} onClick={() => setType(o.v)} className="flex-shrink-0">{o.label}</Chip>
        ))}
      </div>

      {/* v7.4.5 — Calendar toggle moved off the title row to stop it from
          overlapping the heading at narrow widths. Sits inline with the
          Saved Views controls so the whole filter-toolbox lives on one row. */}
      <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
        <button
          onClick={() => setShowCalendar(v => !v)}
          aria-pressed={showCalendar}
          title="Toggle expense calendar"
          className={`h-[34px] px-3 rounded-md border flex items-center gap-1.5 font-mono text-[0.62rem] tracking-wider uppercase transition-colors ${
            showCalendar
              ? 'bg-coral-tint border-coral/40 text-coral'
              : 'bg-bg border-line text-ink-mid hover:bg-bg3'
          }`}
        >
          <CalendarDays size={14} /> Calendar
        </button>
        <SavedViewsBar
          page="transactions"
          filters={{ type, cat, month, selectedDate }}
          onApply={f => {
            if (typeof f.type === 'string') setType(f.type as TxnFilter);
            else setType('all');
            if (typeof f.cat === 'string') setCat(f.cat); else setCat('all');
            if (typeof f.month === 'string') setMonth(f.month); else setMonth('all');
            if (typeof f.selectedDate === 'string') setSelectedDate(f.selectedDate);
            else setSelectedDate(null);
          }}
        />
      </div>

      {/* Expense calendar — shown on demand via the Calendar button */}
      {showCalendar && (
        <TxnCalendar
          transactions={txns}
          schedules={schedules}
          initialMonth={month !== 'all' ? month : nowMonthKey()}
          selectedDate={selectedDate}
          onSelectDate={handleSelectDate}
          currency={profile.baseCurrency}
        />
      )}

      {/* Active day filter chip */}
      {selectedDate && (
        <div className="mb-4 flex items-center gap-2">
          <span className="inline-flex items-center gap-2 bg-coral-tint border border-coral/40 text-coral rounded-full px-3 py-1 text-[0.78rem]">
            Showing {formatDate(selectedDate, profile.dateFormat)}
            <button onClick={() => setSelectedDate(null)} aria-label="Clear date filter" className="hover:opacity-70">
              <X size={13} />
            </button>
          </span>
        </div>
      )}

      <Panel>
        {/* Slim filter bar: search + filter icon (with active-count badge).
            Mobile-first — collapses heavy selects into a popover so the page
            doesn't burn 5 select rows of vertical real estate by default. */}
        <div className="px-3 sm:px-4 py-2.5 border-b border-line">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-dim pointer-events-none"
                aria-hidden
              />
              <Input
                ref={searchRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search transactions…  ( / )"
                aria-label="Search transactions"
                className="!pl-9 !pr-9"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 row-action"
                >
                  <X size={13} strokeWidth={1.8} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowFilters(true)}
              aria-haspopup="dialog"
              title="Filters"
              className={`relative h-[38px] w-[38px] rounded-[9px] border flex items-center justify-center transition-colors ${
                activeFilters.length > 0
                  ? 'bg-coral-tint border-coral/40 text-coral'
                  : 'bg-bg border-line text-ink-mid hover:bg-bg3 hover:text-ink'
              }`}
            >
              <SlidersHorizontal size={15} />
              {activeFilters.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-1 rounded-full bg-coral text-white text-[0.58rem] font-mono font-semibold flex items-center justify-center leading-none">
                  {activeFilters.length}
                </span>
              )}
            </button>
          </div>

          {/* Active filter chip row — lets users remove individual filters
              one tap at a time without re-opening the popover. */}
          {activeFilters.length > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {activeFilters.map(f => (
                <span
                  key={f.key}
                  className="inline-flex items-center gap-1.5 bg-bg3 border border-line rounded-full pl-2.5 pr-1.5 py-0.5 text-[0.72rem] text-ink-mid"
                >
                  {f.label}
                  <button onClick={f.clear} aria-label={`Clear ${f.key} filter`} className="text-ink-dim hover:text-coral">
                    <X size={11} strokeWidth={2} />
                  </button>
                </span>
              ))}
              <button
                onClick={resetAllFilters}
                className="text-[0.7rem] text-ink-dim hover:text-coral underline-offset-2 hover:underline ml-1"
              >
                Clear all
              </button>
            </div>
          )}

          {/* Result count + filtered net — instant feedback on what the
              filter actually returns. Hidden when the list is empty so it
              doesn't compete with the empty state. */}
          {filtered.length > 0 && (
            <div className="mt-2 flex items-center justify-between text-[0.7rem] font-mono text-ink-dim">
              <span>
                {filtered.length} {filtered.length === 1 ? 'transaction' : 'transactions'}
              </span>
              {(type === 'all' || type === 'income' || type === 'expense') && (
                <span className={filteredNet >= 0 ? 'text-sage' : 'text-terra'}>
                  Net {filteredNet >= 0 ? '+' : ''}{fmt(filteredNet, profile.baseCurrency)}
                </span>
              )}
            </div>
          )}
        </div>

        {filtered.length === 0 ? (
          hasFilters ? (
            <div className="py-12 px-4 text-center">
              <div className="text-3xl mb-2">🔍</div>
              <div className="text-ink-mid mb-3">No transactions match your filters.</div>
              <button onClick={resetAllFilters} className="btn-secondary text-[0.74rem] py-1.5 px-3 inline-flex items-center gap-1.5">
                <RotateCcw size={13} /> Clear filters
              </button>
            </div>
          ) : (
            <EmptyState icon="📝" message="No transactions yet — add your first one to get started." />
          )
        ) : (
          <div>
            {visibleGroups.map(group => {
              const isCollapsed = collapsedMonths.has(group.key);
              const regionId = `txn-month-${group.key}`;
              return (
                <div key={group.key} className="border-b border-line last:border-b-0">
                  {/* Month+year accordion header — sticky so it stays visible
                      while its rows scroll past. */}
                  <button
                    type="button"
                    onClick={() => toggleMonth(group.key)}
                    aria-expanded={!isCollapsed}
                    aria-controls={regionId}
                    className="sticky top-0 z-10 w-full flex items-center gap-2.5 px-3 sm:px-4 py-2.5 border-b border-line hover:brightness-105 transition-[filter] text-left"
                    style={{ background: 'var(--glass)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)' }}
                  >
                    <ChevronDown
                      size={15}
                      strokeWidth={2}
                      className={`text-ink-dim flex-shrink-0 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                    />
                    <span className="font-semibold text-ink text-[0.86rem]">{group.label}</span>
                    <span className="font-mono text-[0.6rem] tracking-wider uppercase text-ink-dim">
                      {group.items.length} {group.items.length === 1 ? 'txn' : 'txns'}
                    </span>
                    <span className={`ml-auto font-mono text-[0.72rem] ${group.net >= 0 ? 'text-sage' : 'text-terra'}`}>
                      {group.net >= 0 ? '+' : ''}{fmt(group.net, profile.baseCurrency)}
                    </span>
                  </button>
                  {!isCollapsed && (
                    <div id={regionId}>
                      {group.items.map(item => (
                        <TxnRow
                          key={item.txn.id}
                          txn={item.txn}
                          showActions={!item.projected}
                          onEdit={openEditTxn}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {hasMoreMonths && (
              <div className="px-4 py-4 flex flex-col items-center gap-1.5 border-t border-line">
                <button
                  onClick={() => setVisibleMonths(c => c + MONTHS_PER_PAGE)}
                  className="btn-secondary text-[0.78rem] py-1.5 px-4"
                >
                  Load previous {MONTHS_PER_PAGE} months
                </button>
                <span className="font-mono text-[0.6rem] tracking-wider uppercase text-ink-dim">
                  Showing {visibleGroups.length} of {monthGroups.length} months
                </span>
              </div>
            )}
          </div>
        )}
      </Panel>

      {/* Batch B — filter half-sheet (board M2): chips instead of dropdowns,
          Apply previews the live result count + net. */}
      <HalfSheet open={showFilters} onClose={() => setShowFilters(false)} title="Filters"
        footer={
          <div className="flex items-center gap-2">
            <button onClick={resetAllFilters} disabled={!hasFilters} className="btn-secondary flex-shrink-0 disabled:opacity-40">Reset</button>
            <button onClick={() => setShowFilters(false)} className="btn-primary flex-1">
              Show {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
              {(type === 'all' || type === 'income' || type === 'expense') ? ` · ${filteredNet >= 0 ? '+' : ''}${fmt(filteredNet, profile.baseCurrency)}` : ''}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <div className="mono-label mb-1.5">Type</div>
            <div className="flex gap-1.5 flex-wrap">
              {([['all','All'],['expense','Expense'],['income','Income'],['transfer','Transfer'],['investment','Investment']] as [TxnFilter,string][]).map(([v,l]) => (
                <Chip key={v} on={type === v} onClick={() => setType(v)}>{l}</Chip>
              ))}
            </div>
          </div>
          <div>
            <div className="mono-label mb-1.5">Category</div>
            <div className="flex gap-1.5 flex-wrap max-h-[168px] overflow-y-auto">
              <Chip on={cat === 'all'} onClick={() => setCat('all')}>All</Chip>
              {ALL_CATEGORIES.map(c => (
                <Chip key={c.id} on={cat === c.id} onClick={() => setCat(c.id)}>{c.icon} {c.label}</Chip>
              ))}
            </div>
          </div>
          {months.length > 0 && (
            <div>
              <div className="mono-label mb-1.5">Month</div>
              <div className="flex gap-1.5 flex-wrap">
                <Chip on={month === 'all'} onClick={() => setMonth('all')}>All</Chip>
                {months.map(mk => <Chip key={mk} on={month === mk} onClick={() => setMonth(mk)}>{monthName(mk)}</Chip>)}
              </div>
            </div>
          )}
          {members.length > 0 && (
            <div>
              <div className="mono-label mb-1.5">Member</div>
              <div className="flex gap-1.5 flex-wrap">
                <Chip on={memberId === 'all'} onClick={() => setMemberId('all')}>All</Chip>
                {members.map(m => <Chip key={m.id} on={memberId === m.id} onClick={() => setMemberId(m.id)}>{m.name}</Chip>)}
              </div>
            </div>
          )}
        </div>
      </HalfSheet>
    </div>
  );
}
