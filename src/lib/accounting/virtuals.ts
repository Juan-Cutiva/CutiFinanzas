import dayjs from 'dayjs';
import type { TransactionKind } from './kinds';

/**
 * Materialización VIRTUAL (en memoria) de ocurrencias de reglas recurrentes.
 * No escribe en BD — solo proyecta hacia adelante para el dashboard / saldos estimados.
 *
 * Las ocurrencias REALES (ya cobradas/pagadas) viven en la tabla `transactions` y son
 * inmutables a cambios posteriores en la regla.
 *
 * Reglas de generación:
 * - Las ocurrencias se generan respetando startDate ≤ fecha ≤ (endDate ?? ∞).
 * - El cron materializa ocurrencias con fecha ≤ today.
 * - Esta función genera las pendientes (today < fecha ≤ asOfDate) — útil para proyectar
 *   saldos al fin de un mes futuro o cuotas pendientes de una deuda.
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
 * Genera las ocurrencias virtuales de una regla en el rango (fromExclusive, toInclusive].
 * Útil para proyectar pagos pendientes desde "después de hoy" hasta "fin del mes elegido".
 *
 * Si fromExclusive === toInclusive y no hay coincidencia exacta, devuelve vacío.
 */
export function generateVirtualOccurrences(
  rule: RecurringRuleForVirtuals,
  fromExclusive: string,
  toInclusive: string,
): VirtualOccurrence[] {
  if (!rule.isActive) return [];
  const start = rule.startDate;
  const end = rule.endDate ?? '9999-12-31';

  // Punto de partida: la primera ocurrencia que sea > fromExclusive y >= start.
  let cursor = dayjs(start);
  const fromEx = dayjs(fromExclusive);
  const toIn = dayjs(toInclusive);

  // avanza cursor hasta superar fromExclusive
  if (cursor.isBefore(fromEx) || cursor.isSame(fromEx)) {
    cursor = nextOccurrenceFrom(cursor, fromEx, rule);
  }

  const out: VirtualOccurrence[] = [];
  while (cursor.isBefore(toIn) || cursor.format('YYYY-MM-DD') === toIn.format('YYYY-MM-DD')) {
    const iso = cursor.format('YYYY-MM-DD');
    if (iso > end) break;
    if (iso >= start) {
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

function nextOccurrenceFrom(
  start: dayjs.Dayjs,
  afterExclusive: dayjs.Dayjs,
  rule: RecurringRuleForVirtuals,
): dayjs.Dayjs {
  let cursor = start;
  // jump hasta superar afterExclusive con paso seguro
  while (
    cursor.isBefore(afterExclusive) ||
    cursor.format('YYYY-MM-DD') === afterExclusive.format('YYYY-MM-DD')
  ) {
    cursor = advance(cursor, rule);
  }
  return cursor;
}
