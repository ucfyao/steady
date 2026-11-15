import type { ReactNode } from 'react';
import styles from './Chip.module.css';

/**
 * One pill-shaped choice. It is a native radio, visually hidden, inside its label, so
 * Tab, the arrow keys and screen readers behave exactly like a radio group.
 */
export function Chip({
  name,
  value,
  checked,
  onSelect,
  children,
}: {
  name: string;
  value: string;
  checked: boolean;
  onSelect(value: string): void;
  children: ReactNode;
}) {
  return (
    <label className={styles.chip}>
      <input
        className={styles.input}
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onSelect(value)}
      />
      <span className={styles.pill}>{children}</span>
    </label>
  );
}

export type ChipOption<T extends string> = { value: T; label: ReactNode };

/** A single-choice group of chips with a visible legend. */
export function ChipGroup<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: ReactNode;
  name: string;
  options: readonly ChipOption<T>[];
  value: T;
  onChange(value: T): void;
}) {
  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.chips}>
        {options.map((o) => (
          <Chip
            key={o.value}
            name={name}
            value={o.value}
            checked={o.value === value}
            onSelect={(v) => onChange(v as T)}
          >
            {o.label}
          </Chip>
        ))}
      </div>
    </fieldset>
  );
}
