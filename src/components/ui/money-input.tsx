'use client';

import * as React from 'react';
import { Input, type InputProps } from './input';

export interface MoneyInputProps
  extends Omit<InputProps, 'value' | 'onChange' | 'type' | 'inputMode'> {
  value: number | string | null | undefined;
  onChange: (value: number | undefined) => void;
  locale?: string;
  allowNegative?: boolean;
  allowDecimals?: boolean;
}

function getLocaleSeparators(locale: string): { group: string; decimal: string } {
  const parts = new Intl.NumberFormat(locale).formatToParts(12345.6);
  return {
    group: parts.find((p) => p.type === 'group')?.value ?? ',',
    decimal: parts.find((p) => p.type === 'decimal')?.value ?? '.',
  };
}

function format(n: number | undefined, locale: string, allowDecimals: boolean): string {
  if (n === undefined || Number.isNaN(n)) return '';
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: allowDecimals ? 2 : 0,
  }).format(n);
}

function parseRaw(
  raw: string,
  locale: string,
  allowNegative: boolean,
  allowDecimals: boolean,
): { value: number | undefined; trailingDecimal: string | null; isNegative: boolean } {
  const { group, decimal } = getLocaleSeparators(locale);
  const isNegative = allowNegative && raw.trim().startsWith('-');

  let cleaned = raw.replace(new RegExp(`\\${group}`, 'g'), '');
  cleaned = cleaned.replace(/[^\d.,-]/g, '').replace(/-/g, '');

  if (allowDecimals) {
    const decimalRe = decimal === '.' ? /\./g : /,/g;
    const otherRe = decimal === '.' ? /,/g : /\./g;
    cleaned = cleaned.replace(otherRe, '');

    const firstDecimalAt = cleaned.search(decimalRe);
    if (firstDecimalAt !== -1) {
      const before = cleaned.slice(0, firstDecimalAt);
      const after = cleaned
        .slice(firstDecimalAt + 1)
        .replace(decimalRe, '')
        .slice(0, 2);
      const dotForm = `${before}.${after}`;
      const trailingDecimal = `.${after}`;
      const n = Number(dotForm);
      return {
        value: Number.isNaN(n) || dotForm === '.' ? undefined : isNegative ? -n : n,
        trailingDecimal,
        isNegative,
      };
    }
  } else {
    cleaned = cleaned.replace(/[.,]/g, '');
  }

  if (cleaned === '') {
    return { value: undefined, trailingDecimal: null, isNegative };
  }
  const n = Number(cleaned);
  return {
    value: Number.isNaN(n) ? undefined : isNegative ? -n : n,
    trailingDecimal: null,
    isNegative,
  };
}

function buildDisplay(
  parsed: ReturnType<typeof parseRaw>,
  locale: string,
  allowDecimals: boolean,
): string {
  const { value, trailingDecimal, isNegative } = parsed;
  if (value === undefined) {
    if (trailingDecimal) {
      const { decimal } = getLocaleSeparators(locale);
      return `${isNegative ? '-' : ''}0${decimal}${trailingDecimal.slice(1)}`;
    }
    return isNegative ? '-' : '';
  }

  if (trailingDecimal && allowDecimals) {
    const intPart = Math.trunc(Math.abs(value));
    const intStr = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(intPart);
    const { decimal } = getLocaleSeparators(locale);
    const trailing = trailingDecimal.slice(1);
    return `${value < 0 ? '-' : ''}${intStr}${decimal}${trailing}`;
  }

  return format(value, locale, allowDecimals);
}

function countDigits(s: string): number {
  let count = 0;
  for (const ch of s) {
    if (ch >= '0' && ch <= '9') count++;
  }
  return count;
}

function caretAfterFormat(formatted: string, digitsBefore: number): number {
  if (digitsBefore <= 0) {
    return formatted.startsWith('-') ? 1 : 0;
  }
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    const ch = formatted[i];
    if (ch && ch >= '0' && ch <= '9') {
      seen++;
      if (seen === digitsBefore) return i + 1;
    }
  }
  return formatted.length;
}

function toNumber(v: number | string | null | undefined): number | undefined {
  if (v === '' || v === null || v === undefined) return undefined;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isNaN(n) ? undefined : n;
}

export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  (
    {
      value,
      onChange,
      onBlur,
      locale = 'es-CO',
      allowNegative = false,
      allowDecimals = true,
      className,
      ...props
    },
    ref,
  ) => {
    const [display, setDisplay] = React.useState<string>(() =>
      format(toNumber(value), locale, allowDecimals),
    );
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const userIsEditing = React.useRef(false);

    React.useEffect(() => {
      if (userIsEditing.current) return;
      setDisplay(format(toNumber(value), locale, allowDecimals));
    }, [value, locale, allowDecimals]);

    return (
      <Input
        {...props}
        ref={(node) => {
          inputRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        type="text"
        inputMode={allowDecimals ? 'decimal' : 'numeric'}
        autoComplete="off"
        className={className}
        value={display}
        onChange={(e) => {
          userIsEditing.current = true;
          const target = e.target as HTMLInputElement;
          const rawValue = target.value;
          const caretBefore = target.selectionStart ?? rawValue.length;
          const digitsBefore = countDigits(rawValue.slice(0, caretBefore));

          const parsed = parseRaw(rawValue, locale, allowNegative, allowDecimals);
          const nextDisplay = buildDisplay(parsed, locale, allowDecimals);

          setDisplay(nextDisplay);
          onChange(parsed.value);

          requestAnimationFrame(() => {
            const node = inputRef.current;
            if (!node || document.activeElement !== node) return;
            const pos = caretAfterFormat(nextDisplay, digitsBefore);
            node.setSelectionRange(pos, pos);
          });
        }}
        onBlur={(e) => {
          userIsEditing.current = false;
          const n = toNumber(value);
          setDisplay(format(n, locale, allowDecimals));
          onBlur?.(e);
        }}
      />
    );
  },
);
MoneyInput.displayName = 'MoneyInput';
