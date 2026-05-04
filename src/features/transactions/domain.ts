import { type CurrencyCode, moneyFromMajor, moneyToMinor } from '@/lib/money';

export function getQuincenaFromIsoDate(iso: string): 1 | 2 {
  const day = Number.parseInt(iso.slice(8, 10), 10);
  return day <= 15 ? 1 : 2;
}

export function amountMajorToMinor(amount: number, currency: CurrencyCode): bigint {
  return BigInt(moneyToMinor(moneyFromMajor(amount, currency)));
}

const INCOME_KINDS = new Set(['income', 'income_fixed', 'income_variable', 'refund']);

const EXPENSE_KINDS = new Set([
  'expense_fixed',
  'expense_variable',
  'debt_payment',
  'savings_contribution',
]);

const NON_CASHFLOW_KINDS = new Set(['transfer', 'credit_card_payment']);

export function isIncomeKind(kind: string): boolean {
  return INCOME_KINDS.has(kind);
}

export function isExpenseKind(kind: string): boolean {
  return EXPENSE_KINDS.has(kind);
}

export function isFixedKind(kind: string): boolean {
  return kind === 'income_fixed' || kind === 'expense_fixed';
}

/** Indica si el kind cuenta como flujo de caja real (excluye transfers y pagos a TC). */
export function isCashflowKind(kind: string): boolean {
  return !NON_CASHFLOW_KINDS.has(kind);
}

export function signFor(kind: string): 1 | -1 {
  return isIncomeKind(kind) ? 1 : -1;
}
