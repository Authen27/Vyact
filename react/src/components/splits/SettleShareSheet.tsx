// Vyact — where a split repayment came in (v10.134.0, Track Q6; audit FE-MNY-08; owner decision 20 Oct 2026: "settling
// records the money into a chosen account").
//
// On a split you paid in full (`split.fullDebit`), the whole bill left your account and the others' shares are Owed to
// you. Marking someone paid records the account their share came back into: that account rises by the share and Owed
// to you falls by it. Net worth, spending and income do not move. Defaults to the account the bill was paid from.
import { useEffect, useMemo, useState } from 'react';
import HalfSheet from '../ui/HalfSheet';
import Button from '../ui/Button';
import { Field, Select } from '../ui/Input';
import { useStore } from '../../store';
import { buildAccountsFromStore } from '../../lib/accounts';
import { fmt } from '../../lib/format';

export interface SettleTarget {
  txnId: string;
  /** The participants being marked paid. */
  names: string[];
  amount: number;
  currency: string;
  /** The picker value of the account the bill was paid from. */
  defaultAccount?: string;
}

export default function SettleShareSheet({ target, onClose, onConfirm }: {
  target: SettleTarget | null;
  onClose: () => void;
  onConfirm: (target: SettleTarget, accountValue: string) => Promise<void>;
}) {
  const accounts = useStore(s => s.accounts);
  const toast = useStore(s => s.toast);
  // Money comes back into a bank account or cash, never a card, a loan or an investment.
  const options = useMemo(() => buildAccountsFromStore(accounts, { filter: o => o.kind === 'bank' || o.kind === 'cash' }), [accounts]);
  const [account, setAccount] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!target) return;
    setAccount(target.defaultAccount && options.some(o => o.value === target.defaultAccount) ? target.defaultAccount : (options[0]?.value ?? ''));
  }, [target, options]);

  const who = !target ? '' : target.names.length === 1 ? target.names[0] : `${target.names.length} people`;
  async function record() {
    if (!target || !account) return;
    setBusy(true);
    try { await onConfirm(target, account); onClose(); }
    catch (e) { toast(`Couldn't record the repayment: ${(e as Error).message}`, 'error'); }
    finally { setBusy(false); }
  }
  return (
    <HalfSheet open={!!target} onClose={onClose} title={`${who} paid you back`}
      footer={(
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button full onClick={() => void record()} disabled={busy || !account}>{busy ? 'Saving…' : 'Record repayment'}</Button>
        </div>
      )}>
      {target && (
        <>
          <p className="text-[0.86rem] text-ink-mid mb-3">
            <strong className="num text-ink">{fmt(target.amount, target.currency)}</strong> comes off Owed to you and into the
            account you choose. It isn&apos;t income, and your spending on this split stays your share.
          </p>
          <Field label="Came back into">
            <Select value={account} onChange={e => setAccount(e.target.value)} aria-label="Came back into">
              {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
        </>
      )}
    </HalfSheet>
  );
}
