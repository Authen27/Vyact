// Vyact v7.1.3 — Accounts page
//
// Surfaces the first-class `accounts` table from the v7.1 Money Map
// migration as a real CRUD list. Gated by `getMoneyMapMode() !== 'off'`
// at the route level — when the flag is off the route renders an
// empty-state explaining why.
//
// The list shows every non-deleted account; archived ones are dimmed
// and grouped under a collapsed section. Default-per-currency is shown
// as a chip. Linked to a backfilled asset/debt? We surface that with a
// small caption so the user understands where the row came from.

import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { Panel } from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Plus, Pencil, Star, Archive, ArchiveRestore, Link as LinkIcon } from 'lucide-react';
import type { Account, AccountKind } from '../types';
import { getMoneyMapMode } from '../lib/featureFlags';

const KIND_LABEL: Record<AccountKind, string> = {
  checking: 'Checking',
  savings: 'Savings',
  credit_card: 'Credit Card',
  cash: 'Cash',
  investment: 'Investment',
  wallet: 'Wallet',
  other: 'Other',
};

export default function Accounts() {
  const accounts        = useStore(s => s.accounts);
  const assets          = useStore(s => s.assets);
  const debts           = useStore(s => s.debts);
  const openAddAccount  = useStore(s => s.openAddAccount);
  const openEditAccount = useStore(s => s.openEditAccount);
  const upsertAccount   = useStore(s => s.upsertAccount);
  const toast           = useStore(s => s.toast);
  const [showArchived, setShowArchived] = useState(false);

  const mode = getMoneyMapMode();
  const flagOff = mode === 'off';

  const { active, archived } = useMemo(() => {
    const a: Account[] = [];
    const ar: Account[] = [];
    for (const acc of accounts) (acc.isArchived ? ar : a).push(acc);
    a.sort((x, y) => x.name.localeCompare(y.name));
    ar.sort((x, y) => x.name.localeCompare(y.name));
    return { active: a, archived: ar };
  }, [accounts]);

  // Resolve assetId → human label so backfilled rows show their origin.
  const linkLabel = (acc: Account): string | null => {
    if (!acc.assetId) return null;
    const ast = assets.find(a => a.id === acc.assetId);
    if (ast) return `Linked to asset · ${ast.name}`;
    const dbt = debts.find(d => d.id === acc.assetId);
    if (dbt) return `Linked to card · ${dbt.name}`;
    return 'Linked (origin removed)';
  };

  async function toggleArchive(acc: Account) {
    try {
      await upsertAccount({ ...acc, isArchived: !acc.isArchived });
      toast(acc.isArchived ? 'Account restored' : 'Account archived', 'success');
    } catch (e) {
      toast(`Failed: ${(e as Error).message}`, 'error');
    }
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="display-italic text-4xl text-ink mb-1.5">Accounts</h1>
          <p className="font-mono text-[0.6rem] tracking-[0.14em] uppercase text-ink-dim">
            Money Map · Spendable Accounts
          </p>
        </div>
        {!flagOff && (
          <Button onClick={openAddAccount}>
            <Plus size={14} /> Add Account
          </Button>
        )}
      </div>

      {flagOff && (
        <Panel>
          <div className="p-6 text-center">
            <p className="text-ink-mid mb-2">Money Map is off.</p>
            <p className="text-sm text-ink-dim">
              Enable the <code className="font-mono">money_map</code> flag to manage
              first-class accounts. Until then, the transaction picker continues
              to derive accounts from Net Worth assets and credit cards.
            </p>
          </div>
        </Panel>
      )}

      {!flagOff && active.length === 0 && (
        <Panel>
          <div className="p-6 text-center">
            <p className="text-ink-mid mb-3">No accounts yet.</p>
            <p className="text-sm text-ink-dim mb-4">
              Cloud households are seeded automatically by the Phase 1 backfill.
              If your list is empty, add one manually or refresh after the
              migration runs.
            </p>
            <Button onClick={openAddAccount}>
              <Plus size={14} /> Add Your First Account
            </Button>
          </div>
        </Panel>
      )}

      {!flagOff && active.length > 0 && (
        <Panel>
          <div className="divide-y divide-line">
            {active.map(acc => (
              <AccountRow
                key={acc.id}
                acc={acc}
                linkLabel={linkLabel(acc)}
                onEdit={() => openEditAccount(acc)}
                onArchive={() => toggleArchive(acc)}
              />
            ))}
          </div>
        </Panel>
      )}

      {!flagOff && archived.length > 0 && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setShowArchived(s => !s)}
            className="font-mono text-[0.6rem] tracking-[0.14em] uppercase text-ink-dim hover:text-ink-mid mb-2"
          >
            {showArchived ? '▾' : '▸'} Archived ({archived.length})
          </button>
          {showArchived && (
            <Panel>
              <div className="divide-y divide-line opacity-70">
                {archived.map(acc => (
                  <AccountRow
                    key={acc.id}
                    acc={acc}
                    linkLabel={linkLabel(acc)}
                    onEdit={() => openEditAccount(acc)}
                    onArchive={() => toggleArchive(acc)}
                  />
                ))}
              </div>
            </Panel>
          )}
        </div>
      )}

      {!flagOff && mode === 'shadow' && (
        <p className="font-mono text-[0.6rem] tracking-[0.14em] uppercase text-ink-dim mt-6">
          Shadow mode · changes apply to the canonical accounts table; legacy
          assets / debts continue to drive the picker until <code>money_map</code> = on.
        </p>
      )}
    </div>
  );
}

function AccountRow(props: {
  acc: Account;
  linkLabel: string | null;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const { acc, linkLabel, onEdit, onArchive } = props;
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-ink font-medium truncate">{acc.name}</span>
          <span className="font-mono text-[0.6rem] tracking-wider uppercase text-ink-dim">
            {KIND_LABEL[acc.kind]} · {acc.currency}
          </span>
          {acc.isDefault && (
            <span className="inline-flex items-center gap-1 font-mono text-[0.6rem] tracking-wider uppercase text-coral">
              <Star size={10} /> Default
            </span>
          )}
        </div>
        {linkLabel && (
          <div className="flex items-center gap-1 mt-0.5 text-[0.7rem] text-ink-dim">
            <LinkIcon size={10} /> {linkLabel}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="text-ink-mid hover:text-ink p-1.5 rounded hover:bg-bg3"
        aria-label="Edit account"
        title="Edit"
      >
        <Pencil size={14} />
      </button>
      <button
        type="button"
        onClick={onArchive}
        className="text-ink-mid hover:text-ink p-1.5 rounded hover:bg-bg3"
        aria-label={acc.isArchived ? 'Restore account' : 'Archive account'}
        title={acc.isArchived ? 'Restore' : 'Archive'}
      >
        {acc.isArchived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
      </button>
    </div>
  );
}
