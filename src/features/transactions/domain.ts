import { nextOccurrence, type RecurrenceFrequencyValue } from '@/lib/accounting/recurrence';
import {
  EXPENSE_KINDS,
  INCOME_KINDS,
  isExpenseOfMonth,
  isIncomeOfMonth,
  isInternal,
  KIND_LABELS,
  type TransactionKind,
} from '@/lib/accounting/shared';
import { type CurrencyCode, moneyFromMajor, moneyToMinor } from '@/lib/money';

export type { RecurrenceFrequencyValue, TransactionKind };
export {
  EXPENSE_KINDS,
  INCOME_KINDS,
  isExpenseOfMonth,
  isIncomeOfMonth,
  isInternal,
  KIND_LABELS,
  nextOccurrence,
};

export function amountMajorToMinor(amount: number, currency: CurrencyCode): bigint {
  return BigInt(moneyToMinor(moneyFromMajor(amount, currency)));
}

/**
 * Alias retro-compatible. Delega en `nextOccurrence`. Acepta `dayOfMonth`
 * opcional — pásalo siempre que la regla lo tenga para evitar divergencias.
 */
export function nextOccurrenceFor(
  startDate: string,
  frequency: RecurrenceFrequencyValue,
  dayOfMonth?: number | null,
): string {
  return nextOccurrence(startDate, frequency, dayOfMonth);
}
