import { useState, useMemo } from 'react';
import { Plus, CalendarDays, X } from 'lucide-react';
import { useStore } from '../store';
import { useTranslation, useShortcuts } from '../hooks';
import { Panel } from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Button from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import TxnRow from '../components/transactions/TxnRow';
import TxnCalendar from '../components/transactions/TxnCalendar';
import { ALL_CATEGORIES } from '../constants';
import { getMonthKey, monthName, formatDate, nowMonthKey } from '../lib/format';

export default function Transactions() {
  const { t } = useTranslation();
  const txns    = useStore(s => s.transactions);
  const members = useStore(s => s.members);
  const schedules = useStore(s => s.recurringSchedules);
  const profile = useStore(s => s.profile);
  const openAddTxn  = useStore(s => s.openAddTxn);
  const openEditTxn = useStore(s => s.openEditTxn);

  const [search,   setSearch]   = useState('');
  const [type,     setType]     = useState<'all'|'income'|'expense'|'investment'|'transfer'>('all');
  const [cat,      setCat]      = useState('all');
  const [month,    setMonth]    = useState('all');
  const [memberId, setMemberId] = useState('all');
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useShortcuts({ n: openAddTxn, N: openAddTxn });

  const months = useMemo(
    () => [...new Set(txns.map(t => getMonthKey(t.date)))].sort().reverse(),
    [txns]
  );

  const filtered = useMemo(() => {
    let f = [...txns];
    if (selectedDate)       f = f.filter(t => t.date === selectedDate);
    if (type !== 'all')     f = f.filter(t => t.type === type);
    if (cat !== 'all')      f = f.filter(t => t.category === cat);
    if (!selectedDate && month !== 'all') f = f.filter(t => getMonthKey(t.date) === month);
    if (memberId !== 'all') f = f.filter(t => t.memberId === memberId);
    if (search) {
      const q = search.toLowerCase();
      f = f.filter(t =>
        t.description.toLowerCase().includes(q) ||
        (t.note || '').toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    }
    return f.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }, [txns, search, type, cat, month, memberId, selectedDate]);

  // Tapping a day filters the list to that date (and reveals the calendar if hidden).
  function handleSelectDate(date: string) {
    setSelectedDate(d => (d === date ? null : date));
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="display-italic text-4xl text-ink mb-1.5">{t('transactions')}</h1>
          <p className="font-mono text-[0.6rem] tracking-[0.14em] uppercase text-ink-dim">
            All household income, expenses, investments &amp; transfers
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCalendar(v => !v)}
            aria-pressed={showCalendar}
            title="Toggle expense calendar"
            className={`h-[38px] px-3 rounded-[9px] border flex items-center gap-1.5 font-mono text-[0.62rem] tracking-wider uppercase transition-colors ${
              showCalendar
                ? 'bg-coral-tint border-coral/40 text-coral'
                : 'bg-bg border-line text-ink-mid hover:bg-bg3'
            }`}
          >
            <CalendarDays size={15} /> Calendar
          </button>
          <Button onClick={openAddTxn}>
            <Plus size={14} /> {t('add-transaction')}
          </Button>
        </div>
      </div>

      {/* Expense calendar — shown on demand via the Calendar button */}
      {showCalendar && (
        <TxnCalendar
          transactions={txns}
          schedules={schedules}
          initialMonth={month !== 'all' ? month : nowMonthKey()}
          selectedDate={selectedDate}
          onSelectDate={handleSelectDate}
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
        <div className="flex gap-2 px-4 py-3 border-b border-line flex-wrap">
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className="flex-1 min-w-[120px]" />
          <Select value={type} onChange={e => setType(e.target.value as any)} className="flex-1 min-w-[110px]">
            <option value="all">All Types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="investment">Investment</option>
            <option value="transfer">Transfer</option>
          </Select>
          <Select value={cat} onChange={e => setCat(e.target.value)} className="flex-1 min-w-[140px]">
            <option value="all">All Categories</option>
            {ALL_CATEGORIES.map(c => (
              <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
            ))}
          </Select>
          <Select value={month} onChange={e => setMonth(e.target.value)} className="flex-1 min-w-[140px]">
            <option value="all">All Months</option>
            {months.map(mk => <option key={mk} value={mk}>{monthName(mk)}</option>)}
          </Select>
          <Select value={memberId} onChange={e => setMemberId(e.target.value)} className="flex-1 min-w-[120px]">
            <option value="all">All Members</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
        </div>

        {filtered.length === 0
          ? <EmptyState icon="🔍" message="No transactions found" />
          : filtered.map(t => <TxnRow key={t.id} txn={t} showActions onEdit={openEditTxn} />)
        }
      </Panel>
    </div>
  );
}
