import dayjs from 'dayjs';
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

export type { TransactionKind };
export { EXPENSE_KINDS, INCOME_KINDS, isExpenseOfMonth, isIncomeOfMonth, isInternal, KIND_LABELS };

export function amountMajorToMinor(amount: number, currency: CurrencyCode): bigint {
  return BigInt(moneyToMinor(moneyFromMajor(amount, currency)));
}

/**
 * Calcula la siguiente ocurrencia para una regla recurrente, dada una fecha base.
 */
export function nextOccurrenceFor(
  startDate: string,
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly',
): string {
  const start = dayjs(startDate);
  switch (frequency) {
    case 'weekly':
      return start.add(1, 'week').format('YYYY-MM-DD');
    case 'biweekly':
      return start.add(2, 'week').format('YYYY-MM-DD');
    case 'monthly':
      return start.add(1, 'month').format('YYYY-MM-DD');
    case 'quarterly':
      return start.add(3, 'month').format('YYYY-MM-DD');
    case 'yearly':
      return start.add(1, 'year').format('YYYY-MM-DD');
  }
}
