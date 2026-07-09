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
 * Default de días de anticipación para materializar recurrentes. Debe coincidir
 * con el default de CRON_MATERIALIZE_LOOKAHEAD_DAYS en env.ts.
 */
export const DEFAULT_MATERIALIZE_LOOKAHEAD_DAYS = 2;

/**
 * Normaliza el lookahead a un entero válido en [0, 31], caiga lo que caiga.
 *
 * Necesario porque producción corre con SKIP_ENV_VALIDATION=true y en ese modo
 * t3-env NO aplica el coerce/default de zod: env.CRON_MATERIALIZE_LOOKAHEAD_DAYS
 * llega `undefined` (var ausente) o string crudo. Con `undefined`,
 * dayjs().add(undefined, 'day') produce "Invalid Date" y la query de reglas
 * vencidas revienta en Postgres ANTES de materializar nada — las recurrentes
 * quedaban como "Programado" para siempre y el try/catch lazy silenciaba el error.
 */
export function resolveLookaheadDays(raw: unknown): number {
  if (raw == null) return DEFAULT_MATERIALIZE_LOOKAHEAD_DAYS;
  const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= 31 ? n : DEFAULT_MATERIALIZE_LOOKAHEAD_DAYS;
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
