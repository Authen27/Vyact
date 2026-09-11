import { useId, useRef, useState } from 'react';
import { Combobox, ComboboxButton, ComboboxInput, ComboboxOption, ComboboxOptions, Portal } from '@headlessui/react';
import { Check, ChevronDown, Shapes } from 'lucide-react';
import { categoryOptions, searchCategories } from '../../lib/categoryOptions';
import { getCat } from '../../constants';
import type { TxnType } from '../../types';

interface Props {
  value: string;
  onChange: (value: string) => void;
  type: TxnType | 'all';
  label?: string;
  id?: string;
  disabled?: boolean;
  includeAll?: boolean;
  error?: string;
  hint?: string;
  testId?: string;
}

export default function CategoryPicker({ value, onChange, type, label = 'Category', id, disabled = false,
  includeAll = false, error, hint, testId }: Props) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = `${inputId}-description`;
  const [query, setQuery] = useState('');
  const portalTarget = useRef<HTMLElement | null>(null);
  const categories = categoryOptions(type, value, includeAll);
  const filtered = searchCategories(categories, query);
  const selected = categories.find(category => category.id === value) ?? (value ? getCat(value) : undefined);
  if (type === 'transfer' || type === 'investment') return null;

  return (
    <div className="category-picker" ref={element => { portalTarget.current = element?.closest<HTMLElement>('[role="dialog"]') ?? element; }}>
      <label htmlFor={inputId} className="ui-label block mb-related">{label}</label>
      <Portal.Group target={portalTarget}>
      <Combobox value={value} disabled={disabled} onClose={() => setQuery('')}
        onChange={(next: string | null) => { if (next !== null) onChange(next); }}>
        <div className="category-picker-field">
          <span className="category-picker-icon" aria-hidden="true">
            {selected?.icon || <Shapes size={18} />}
          </span>
          <ComboboxInput id={inputId} data-testid={testId} className="category-picker-input"
            displayValue={() => selected?.label ?? ''} onChange={event => setQuery(event.target.value)}
            placeholder="Choose category" autoComplete="off" title={selected?.label}
            aria-invalid={error ? true : undefined} aria-describedby={error || hint ? descriptionId : undefined} />
          <ComboboxButton className="category-picker-toggle" aria-label={`Show ${label.toLowerCase()} options`}>
            <ChevronDown size={17} aria-hidden="true" />
          </ComboboxButton>
        </div>
        <ComboboxOptions anchor={{ to: 'bottom start', gap: 6, padding: 8 }} modal={false}
          className="category-picker-options">
          {filtered.length === 0 && <div className="category-picker-empty" role="status">No categories found</div>}
          {filtered.map(category => (
            <ComboboxOption key={category.id} value={category.id} className="category-picker-option">
              {({ selected: isSelected }) => <>
                <span aria-hidden="true" className="category-option-icon">{category.icon || <Shapes size={18} />}</span>
                <span className="category-option-label">{category.label}</span>
                {isSelected && <Check size={16} className="category-option-check" aria-hidden="true" />}
              </>}
            </ComboboxOption>
          ))}
        </ComboboxOptions>
      </Combobox>
      </Portal.Group>
      {(error || hint) && <p id={descriptionId} role={error ? 'alert' : undefined}
        className={`text-[12px] mt-2 leading-relaxed ${error ? 'text-terra' : 'text-ink-mid'}`}>{error || hint}</p>}
    </div>
  );
}