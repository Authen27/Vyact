// Aurora forms-doctrine container (v10.1) — now an ACCESSIBLE dialog (audit 6.1).
// A SINGLE responsive glass panel — a bottom half-sheet on mobile, a compact
// centered dialog on desktop (≥sm) — so the form's children render exactly once.
//
// The hand-rolled Escape listener + role="dialog" is replaced by Radix under
// AccessibleDialog: focus is trapped inside, restored to the trigger on close,
// the background is inert, and the close affordance is a real ≥44px control
// (the grabber was 5px). Public props are unchanged; pages still call
// openAdd/close via the store modal-slot pattern.
import { type ReactNode } from 'react';
import AccessibleDialog from './AccessibleDialog';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Accessible label when no visible title is rendered (amount-first sheets). */
  ariaLabel?: string;
  children: ReactNode;
  /** Optional sticky footer (primary action row) that never scrolls away. */
  footer?: ReactNode;
  /** Desktop width — see AccessibleDialog. */
  size?: 'md' | 'lg' | 'xl';
  className?: string;
}

export default function HalfSheet({ open, onClose, title, ariaLabel, children, footer, size, className }: Props) {
  return (
    <AccessibleDialog
      open={open}
      onClose={onClose}
      title={title}
      ariaLabel={ariaLabel}
      footer={footer}
      variant="sheet"
      size={size}
      className={className}
    >
      {children}
    </AccessibleDialog>
  );
}
