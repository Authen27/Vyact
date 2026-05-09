import { type InputHTMLAttributes, type SelectHTMLAttributes, type ReactNode, forwardRef } from 'react';

const baseClass =
  'w-full bg-bg3 border border-line text-ink rounded-md px-3 py-2.5 ' +
  'font-ui text-[0.86rem] outline-none transition-all ' +
  'placeholder:text-ink-dim focus:border-coral focus:ring-2 focus:ring-coral/20';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...rest }, ref) => (
    <input ref={ref} className={`${baseClass} ${className}`} {...rest} />
  )
);
Input.displayName = 'Input';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = '', children, ...rest }, ref) => (
    <select ref={ref} className={`${baseClass} cursor-pointer pr-7 ${className}`} {...rest}>
      {children}
    </select>
  )
);
Select.displayName = 'Select';

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}

export function Field({ label, hint, children }: FieldProps) {
  return (
    <div className="mb-3.5">
      <label className="block font-mono text-[0.6rem] tracking-[0.12em] uppercase text-ink-mid mb-1.5 font-medium">
        {label}{hint && <span className="text-ink-dim ml-1.5">({hint})</span>}
      </label>
      {children}
    </div>
  );
}

export function FieldRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mb-3.5">{children}</div>;
}
