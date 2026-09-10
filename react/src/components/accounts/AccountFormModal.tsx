// Vyact v7.1.3 — AccountFormModal
//
// Money Map: create / rename / archive a first-class account row.
// Mounted once at App root and toggled by the store's `accountModalOpen`
// slot, mirroring AssetFormModal.
//
// Notes
// -----
// - We don't expose `assetId` in the form. The Phase 1 backfill set it for
//   accounts synthesised from existing assets/cards; user-created accounts
//   leave it null and that's the right default.
// - Archive is a soft-toggle (`isArchived = true`); the UI hides archived
//   accounts from pickers without losing historical references.
// - Hard delete remains available (cloud table soft-deletes server-side via
//   the adapter's `remove`); use it only when the user explicitly wants to
//   wipe a never-used account.
//
// v10.23.0 (R1) — three rules changed:
// - NO CURRENCY FIELD. Currency is a household setting (Settings ▸ Language &
//   currency) that every account inherits; the database enforces it with a
//   trigger, so a per-account picker could only ever disagree with the truth.
// - Only BANK and CREDIT CARD can be created here. Cash in Hand is one
//   system-managed account per household (a DB unique index guarantees it);
//   loan accounts are system-only EMI principal legs; investments are moving
//   to Net Worth. An existing account of those kinds can still be renamed, but
//   its kind is shown fixed.
// - Cash in Hand cannot be deleted — cash spend and income need somewhere to
//   post, and a second one would double-count every cash transaction.

import { useEffect, useState } from 'react';
import HalfSheet from '../ui/HalfSheet';
import Button from '../ui/Button';
import { Input, Select, Field } from '../ui/Input';
import { useStore } from '../../store';
import { uid } from '../../lib/format';
import type { Account, AccountKind } from '../../types';

interface Props {
  open?: boolean;
  initial?: Account | null;
  onClose?: () => void;
}

interface FormState {
  kind: AccountKind;
  name: string;
  isDefault: boolean;
  isArchived: boolean;
}

// The kinds a customer can CREATE. Everything else is system-managed.
const CREATABLE_KINDS: { key: AccountKind; label: string }[] = [
  { key: 'bank',        label: 'Bank' },
  { key: 'credit_card', label: 'Credit card' },
];

const KIND_LABEL: Record<AccountKind, string> = {
  bank: 'Bank',
  credit_card: 'Credit card',
  cash: 'Cash in Hand',
  investment: 'Investment',
  loan: 'Loan',
};

const blank = (): FormState => ({
  kind: 'bank',
  name: '',
  isDefault: false,
  isArchived: false,
});

export default function AccountFormModal(props: Props) {
  const profile       = useStore(s => s.profile);
  const upsertAccount = useStore(s => s.upsertAccount);
  const removeAccount = useStore(s => s.removeAccount);
  const toast         = useStore(s => s.toast);

  const storeOpen    = useStore(s => s.accountModalOpen);
  const storeInitial = useStore(s => s.editingAccount);
  const storeClose   = useStore(s => s.closeAccountModal);
  const open         = props.open    ?? storeOpen;
  const initial      = props.initial ?? storeInitial;
  const onClose      = props.onClose ?? storeClose;

  const [form, setForm]     = useState<FormState>(blank());
  const [saving, setSaving] = useState(false);

  // An existing cash / loan / investment account keeps its kind: none of those
  // can be created from here, so switching an account INTO one must not be
  // possible either, and switching one OUT would orphan what depends on it.
  const kindLocked = !!initial && !CREATABLE_KINDS.some(k => k.key === initial.kind);
  const isCash = initial?.kind === 'cash';

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        kind: initial.kind,
        name: initial.name,
        isDefault: !!initial.isDefault,
        isArchived: !!initial.isArchived,
      });
    } else {
      setForm(blank());
    }
  }, [open, initial]);

  async function save() {
    if (!form.name.trim()) { toast('Name is required', 'error'); return; }
    setSaving(true);
    try {
      const acc: Partial<Account> = {
        id: initial?.id ?? uid(),
        // Preserve the backfill-assigned assetId on edits so the FK chain
        // (transaction.account_id → account.asset_id → asset.id) stays
        // intact. New accounts leave it undefined.
        assetId: initial?.assetId,
        kind: form.kind,
        name: form.name.trim(),
        // No currency: upsertAccount stamps the household currency, and the
        // database trigger overrides anything else that arrives.
        isDefault: form.isDefault,
        isArchived: form.isArchived,
        updated_at: initial?.updated_at,
      };
      await upsertAccount(acc);
      toast(initial ? 'Account updated' : 'Account added', 'success');
      onClose();
    } catch (e) {
      toast(`Save failed: ${(e as Error).message}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function del() {
    if (!initial || isCash) return;
    if (!confirm('Delete this account? Transactions linked to it will keep their history but lose the link.')) return;
    try {
      await removeAccount(initial.id);
      toast('Account deleted', 'info');
      onClose();
    } catch (e) {
      toast(`Delete failed: ${(e as Error).message}`, 'error');
    }
  }

  const footer = (
    <div className="flex items-center justify-between gap-2">
      {initial && !isCash ? (
        <button
          type="button"
          onClick={del}
          className="font-mono text-[0.62rem] tracking-wider uppercase text-terra hover:underline"
        >
          Delete
        </button>
      ) : <span />}
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving…' : initial ? 'Update' : 'Add'}
        </Button>
      </div>
    </div>
  );

  return (
    <HalfSheet open={open} title={initial ? 'Edit Account' : 'Add Account'} onClose={onClose} footer={footer}>
      <Field label="Kind">
        {kindLocked ? (
          <div className="input flex items-center text-ink-mid" aria-readonly="true">
            {KIND_LABEL[form.kind]}
          </div>
        ) : (
          <Select
            value={form.kind}
            onChange={e => setForm(f => ({ ...f, kind: e.target.value as AccountKind }))}
          >
            {CREATABLE_KINDS.map(k => (
              <option key={k.key} value={k.key}>{k.label}</option>
            ))}
          </Select>
        )}
      </Field>

      {/* Net Worth reads every cash/bank/investment account's LIVE balance
          directly (lib/accountBalance.ts liveAssetRows) — no backing Asset
          needed, so this is honest for every asset-side kind. */}
      {form.kind !== 'credit_card' && form.kind !== 'loan' && (
        <p className="-mt-1 mb-1 text-[0.7rem] text-sage leading-snug">
          {form.kind === 'investment' ? '📈' : '💰'} This counts toward your <strong>Net Worth</strong> total.
        </p>
      )}

      <Field label="Name">
        <Input
          autoFocus
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder={form.kind === 'credit_card' ? 'e.g. HDFC Regalia' : 'e.g. HDFC Savings'}
        />
      </Field>

      <p className="text-[0.72rem] text-ink-dim leading-snug">
        Currency comes from your household — <strong>{profile.baseCurrency}</strong>. Change it in
        Settings ▸ Language &amp; currency and every account follows.
      </p>

      <div className="flex flex-col gap-2 pt-1">
        <label className="flex items-center gap-2 text-[0.86rem] text-ink-mid">
          <input
            type="checkbox"
            checked={form.isDefault}
            onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))}
          />
          Default account — pre-fills Add Transaction
        </label>
        {!isCash && (
          <label className="flex items-center gap-2 text-[0.86rem] text-ink-mid">
            <input
              type="checkbox"
              checked={form.isArchived}
              onChange={e => setForm(f => ({ ...f, isArchived: e.target.checked }))}
            />
            Archived (hidden from pickers, history retained)
          </label>
        )}
      </div>

    </HalfSheet>
  );
}
