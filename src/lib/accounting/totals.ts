import 'server-only';
import { and, between, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { recurringRules, transactions } from '@/db/schema';
import type { UserId } from '@/types/ids';
import { EXPENSE_KINDS, INCOME_KINDS, type TransactionKind } from './kinds';
import { generateVirtualOccurrences, type RecurringRuleForVirtuals } from './virtuals';

export interface PeriodTotals {
  incomeMinor: bigint;
  expenseMinor: bigint;
  savingsMinor: bigint;
  /** Detalle por kind para drill-down. */
  byKind: Record<TransactionKind, bigint>;
}

/**
 * Suma totales del rango [from, to] inclusive — para mostrar "Ingresos / Gastos del mes/quincena".
 *
 * Incluye:
 * - Transacciones REALES en el rango.
 * - Si `includeVirtuals=true` y el rango es total/parcialmente futuro,
 *   suma virtuals de reglas recurrentes activas.
 */
export async function getPeriodTotals(
  userId: UserId,
  from: string,
  to: string,
  options: { includeVirtuals?: boolean; today?: string } = {},
): Promise<PeriodTotals> {
  const { includeVirtuals = false, today } = options;
  const realRows = await db
    .select({
      kind: transactions.kind,
      sum: sql<string | null>`COALESCE(SUM(${transactions.amountMinor}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.isPaid, true),
        between(transactions.transactionDate, from, to),
      ),
    )
    .groupBy(transactions.kind);

  const byKind = emptyByKind();
  for (const r of realRows) {
    byKind[r.kind as TransactionKind] = BigInt(r.sum ?? 0);
  }

  if (includeVirtuals && today) {
    const virtualFrom = today < from ? from : today; // exclusivo
    const virtualTo = to;
    if (virtualFrom < virtualTo) {
      const rules = await db
        .select()
        .from(recurringRules)
        .where(and(eq(recurringRules.userId, userId), eq(recurringRules.isActive, true)));
      for (const r of rules) {
        const rule = ruleToVirtual(r);
        const occurrences = generateVirtualOccurrences(rule, virtualFrom, virtualTo);
        for (const v of occurrences) {
          if (v.transactionDate >= from && v.transactionDate <= to) {
            byKind[v.kind] += v.amountMinor;
          }
        }
      }
    }
  }

  let incomeMinor = 0n;
  let expenseMinor = 0n;
  const savingsMinor = byKind.savings_contribution;
  for (const k of INCOME_KINDS) incomeMinor += byKind[k];
  for (const k of EXPENSE_KINDS) expenseMinor += byKind[k];

  return { incomeMinor, expenseMinor, savingsMinor, byKind };
}

/**
 * Lista los totales por categoría dentro de un rango — usado por presupuestos y reportes.
 * Solo considera kinds que cuentan como gasto del mes (`EXPENSE_KINDS`).
 */
export async function getCategoryExpenseTotals(
  userId: UserId,
  from: string,
  to: string,
): Promise<Array<{ categoryId: string | null; totalMinor: bigint }>> {
  const rows = await db
    .select({
      categoryId: transactions.categoryId,
      sum: sql<string | null>`COALESCE(SUM(${transactions.amountMinor}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.isPaid, true),
        inArray(transactions.kind, EXPENSE_KINDS as TransactionKind[]),
        between(transactions.transactionDate, from, to),
      ),
    )
    .groupBy(transactions.categoryId);

  return rows.map((r) => ({
    categoryId: r.categoryId,
    totalMinor: BigInt(r.sum ?? 0),
  }));
}

function emptyByKind(): Record<TransactionKind, bigint> {
  return {
    expense: 0n,
    income: 0n,
    refund: 0n,
    transfer: 0n,
    cc_charge: 0n,
    cc_payment: 0n,
    loan_payment: 0n,
    savings_contribution: 0n,
  };
}

function ruleToVirtual(r: typeof recurringRules.$inferSelect): RecurringRuleForVirtuals {
  return {
    id: r.id,
    kind: r.kind,
    amountMinor: BigInt(r.amountMinor as unknown as string | number | bigint),
    currency: r.currency,
    frequency: r.frequency as RecurringRuleForVirtuals['frequency'],
    dayOfMonth: r.dayOfMonth,
    dayOfWeek: r.dayOfWeek,
    startDate: r.startDate,
    endDate: r.endDate,
    accountId: r.accountId,
    counterAccountId: r.counterAccountId,
    categoryId: r.categoryId,
    debtId: r.debtId,
    savingsGoalId: r.savingsGoalId,
    isActive: r.isActive,
  };
}
