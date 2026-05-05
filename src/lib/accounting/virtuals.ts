import dayjs from 'dayjs';
import type { TransactionKind } from './kinds';

/**
 * Materialización VIRTUAL (en memoria) de ocurrencias futuras de reglas recurrentes
 * que aún NO existen como filas reales en `transactions`.
 *
 * IMPORTANTE — invariante para evitar doble conteo:
 * - El cron y `createTransaction` mantienen `recurringRules.nextOccurrenceDate`
 *   apuntando a la PRÓXIMA ocurrencia que aún NO se ha materializado.
 * - Esta función SIEMPRE arranca desde `nextOccurrenceDate`, nunca desde `startDate`.
 * - Así garantizamos que las virtuales sean disjuntas con las transacciones reales.
 */

export type Frequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

export interface RecurringRuleForVirtuals {
  id: string;
  kind: TransactionKind;
  amountMinor: bigint;
  currency: string;
  frequency: Frequency;
  dayOfMonth: number | null;
  dayOfWeek: number | null;
  startDate: string;
  endDate: string | null;
  /**
   * Próxima ocurrencia pendiente de materializar. Punto de partida de las virtuales.
   * Se actualiza por el cron (al insertar una real) y por createTransaction.
   */
  nextOccurrenceDate: string;
  accountId: string;
  counterAccountId: string | null;
  categoryId: string | null;
  debtId: string | null;
  savingsGoalId: string | null;
  isActive: boolean;
}

export interface VirtualOccurrence {
  isVirtual: true;
  ruleId: string;
  kind: TransactionKind;
  amountMinor: bigint;
  currency: string;
  transactionDate: string;
  accountId: string;
  counterAccountId: string | null;
  categoryId: string | null;
  debtId: string | null;
  savingsGoalId: string | null;
}

/**
 * Genera las ocurrencias virtuales de una regla en `[fromInclusive, toInclusive]`.
 *
 * - Arranca desde `rule.nextOccurrenceDate` (NO desde startDate, para no duplicar
 *   con la primera ocurrencia ya materializada).
 * - Si `fromInclusive` se omite, devuelve todas las virtuales hasta `toInclusive`.
 * - Filtra automáticamente por `endDate` y rango activo.
 */
export function generateVirtualOccurrences(
  rule: RecurringRuleForVirtuals,
  toInclusive: string,
  fromInclusive?: string,
): VirtualOccurrence[] {
  if (!rule.isActive) return [];
  const end = rule.endDate ?? '9999-12-31';
  let cursor = dayjs(rule.nextOccurrenceDate);
  const out: VirtualOccurrence[] = [];
  let safety = 366;
  while (safety-- > 0) {
    const iso = cursor.format('YYYY-MM-DD');
    if (iso > toInclusive) break;
    if (iso > end) break;
    if (!fromInclusive || iso >= fromInclusive) {
      out.push({
        isVirtual: true,
        ruleId: rule.id,
        kind: rule.kind,
        amountMinor: rule.amountMinor,
        currency: rule.currency,
        transactionDate: iso,
        accountId: rule.accountId,
        counterAccountId: rule.counterAccountId,
        categoryId: rule.categoryId,
        debtId: rule.debtId,
        savingsGoalId: rule.savingsGoalId,
      });
    }
    cursor = advance(cursor, rule);
  }
  return out;
}

function advance(d: dayjs.Dayjs, rule: RecurringRuleForVirtuals): dayjs.Dayjs {
  switch (rule.frequency) {
    case 'weekly':
      return d.add(1, 'week');
    case 'biweekly':
      return d.add(2, 'week');
    case 'monthly':
      return d.add(1, 'month');
    case 'quarterly':
      return d.add(3, 'month');
    case 'yearly':
      return d.add(1, 'year');
  }
}
