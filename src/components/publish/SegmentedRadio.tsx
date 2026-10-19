'use client';

import { useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
}

interface Props<T extends string> {
  /** Accessible name of the group. */
  label: string;
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (value: T) => void;
}

/**
 * Segmented switch with the ARIA radio-group keyboard contract: one Tab stop
 * (roving tabindex on the checked option) and arrow keys that move focus and
 * select. ArrowDown/ArrowUp are next/previous; Left/Right follow the reading
 * direction (in RTL, ArrowLeft is next). Home/End jump to the first/last option.
 */
export function SegmentedRadio<T extends string>({ label, value, options, onChange }: Props<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const checked = options.findIndex((o) => o.value === value);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const n = options.length;
    if (!n) return;
    const focused = refs.current.findIndex((el) => el === document.activeElement);
    const from = focused === -1 ? Math.max(0, checked) : focused;
    const rtl = getComputedStyle(e.currentTarget).direction === 'rtl';
    let to: number;
    switch (e.key) {
      case 'ArrowDown':
        to = from + 1;
        break;
      case 'ArrowUp':
        to = from - 1;
        break;
      case 'ArrowLeft':
        to = rtl ? from + 1 : from - 1;
        break;
      case 'ArrowRight':
        to = rtl ? from - 1 : from + 1;
        break;
      case 'Home':
        to = 0;
        break;
      case 'End':
        to = n - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    const i = (to + n) % n;
    refs.current[i]?.focus();
    if (options[i].value !== value) onChange(options[i].value);
  };

  return (
    <div className="seg" role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
      {options.map((o, i) => {
        const on = i === checked;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on || (checked === -1 && i === 0) ? 0 : -1}
            className={on ? 'on' : ''}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
