import 'server-only';
import { and, eq, gt, inArray, isNotNull, lte, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { debts, recurringRules, transactions } from '@/db/schema';
import type { UserId } from '@/types/ids';
import { generateVirtualOccurrences, type RecurringRuleForVirtuals } from './virtuals';

export interface DebtState {
  id: string;
  name: string;
  currency: string;
  principalMinor: bigint;
  monthlyPaymentMinor: bigint;
  interestRateAnnual: number | null;
  startDate: string;
  endDate: string | null;
  totalInstallments: number | null;
  status: 'active' | 'paid_off';
  /** Saldo real al día `today` (principal − pagos reales). */
  realBalanceMinor: bigint;
  /** Saldo proyectado al día `asOfDate` (resta cuotas fijas pendientes de today→asOf). */
  projectedBalanceMinor: bigint;
  /** Pagos reales acumulados hasta today. */
  totalPaidMinor: bigint;
  /** Cuotas pagadas (count de loan_payment con esta debt hasta today). */
  paidInstallments: number;
}

interface DebtPaymentTotals {
  sum: bigint;
  count: number;
}

/**
 * Suma agregada de loan_payments por debt hasta `asOfDate`. Devuelve un Map.
 */
async function sumLoanPaymentsByDebt(
  userId: UserId,
  debtIds: string[],
  asOfDate: string,
): Promise<Map<string, DebtPaymentTotals>> {
  if (debtIds.length === 0) return new Map();
  const rows = await db
    .select({
      debtId: transactions.debtId,
      sum: sql<string | null>`COALESCE(SUM(${transactions.amountMinor}), 0)`,
      count: sql<string | null>`COUNT(*)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        inArray(transactions.debtId, debtIds),
        eq(transactions.kind, 'loan_payment'),
        lte(transactions.transactionDate, asOfDate),
      ),
    )
    .groupBy(transactions.debtId);

  const out = new Map<string, DebtPaymentTotals>();
  for (const r of rows) {
    if (r.debtId) {
      out.set(r.debtId, {
        sum: BigInt(r.sum ?? 0),
        count: Number(r.count ?? 0),
      });
    }
  }
  return out;
}

/**
 * Set de (ruleId, date) ya materializadas como loan_payment en (today, asOfDate]
 * para los debts indicados. Para evitar contar virtuales que ya tienen real.
 */
async function materializedLoanKeys(
  userId: UserId,
  debtIds: string[],
  exclusiveFrom: string,
  inclusiveTo: string,
): Promise<Set<string>> {
  if (debtIds.length === 0) return new Set();
  const rows = await db
    .select({ ruleId: transactions.recurringRuleId, date: transactions.transactionDate })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        inArray(transactions.debtId, debtIds),
        eq(transactions.kind, 'loan_payment'),
        gt(transactions.transactionDate, exclusiveFrom),
        lte(transactions.transactionDate, inclusiveTo),
        isNotNull(transactions.recurringRuleId),
      ),
    );
  const set = new Set<string>();
  for (const r of rows) {
    if (r.ruleId) set.add(`${r.ruleId}:${r.date}`);
  }
  return set;
}

/**
 * Estado completo de una deuda, derivado de transactions.
 *
 * Implementación: obtiene la lista de todas las deudas y reusa `listDebtsWithState`
 * para evitar duplicar lógica. Sigue siendo O(1) en queries para una sola deuda.
 */
export async function getDebtState(
  userId: UserId,
  debtId: string,
  asOfDate: string,
  today: string,
): Promise<DebtState | null> {
  const all = await listDebtsWithState(userId, asOfDate, today);
  return all.find((d) => d.id === debtId) ?? null;
}

/**
 * Lista todas las deudas del usuario con saldo real y proyectado.
 *
 * Batch: 1 query lista deudas, hasta 4 queries agregadas en paralelo
 * (pagos hasta today, pagos hasta asOfDate, reglas activas, claves materializadas).
 * Total: 1 + 4 paralelas, independiente del número de deudas.
 */
export async function listDebtsWithState(
  userId: UserId,
  asOfDate: string,
  today: string,
): Promise<DebtState[]> {
  const all = await db.query.debts.findMany({
    where: eq(debts.userId, userId),
    orderBy: (d, { desc }) => [desc(d.createdAt)],
  });
  if (all.length === 0) return [];

  const debtIds = all.map((d) => d.id);
  const isFuture = asOfDate > today;
  const isPast = asOfDate < today;

  const [paidByDebtToday, paidByDebtAsOf, rules, matSet] = await Promise.all([
    sumLoanPaymentsByDebt(userId, debtIds, today),
    isFuture || isPast
      ? sumLoanPaymentsByDebt(userId, debtIds, asOfDate)
      : Promise.resolve(new Map<string, DebtPaymentTotals>()),
    isFuture
      ? db
          .select()
          .from(recurringRules)
          .where(
            and(
              eq(recurringRules.userId, userId),
              eq(recurringRules.isActive, true),
              eq(recurringRules.kind, 'loan_payment'),
              inArray(recurringRules.debtId, debtIds),
            ),
          )
      : Promise.resolve([] as (typeof recurringRules.$inferSelect)[]),
    isFuture
      ? materializedLoanKeys(userId, debtIds, today, asOfDate)
      : Promise.resolve(new Set<string>()),
  ]);

  // Pre-genera ocurrencias virtuales por regla. Luego mapeamos por debtId.
  const projectedPaymentsByDebt = new Map<string, bigint>();
  if (isFuture) {
    for (const r of rules) {
      if (!r.debtId) continue;
      const ruleVirt = toVirtualRule(r);
      const virtuals = generateVirtualOccurrences(ruleVirt, asOfDate);
      let acc = projectedPaymentsByDebt.get(r.debtId) ?? 0n;
      for (const v of virtuals) {
        if (matSet.has(`${r.id}:${v.transactionDate}`)) continue;
        acc += v.amountMinor;
      }
      projectedPaymentsByDebt.set(r.debtId, acc);
    }
  }

  return all.map((debt) => {
    const principal = BigInt(debt.principalMinor as unknown as string | number | bigint);
    const initialPaid = BigInt(debt.initialPaidMinor as unknown as string | number | bigint);

    const paidToday = paidByDebtToday.get(debt.id) ?? { sum: 0n, count: 0 };
    const totalPaidMinor = paidToday.sum;
    const paidInstallments = paidToday.count;
    const realBalanceMinor = principal - initialPaid - totalPaidMinor;

    let projectedBalanceMinor = realBalanceMinor;
    if (isFuture) {
      const paidAsOf = paidByDebtAsOf.get(debt.id)?.sum ?? 0n;
      const projected = projectedPaymentsByDebt.get(debt.id) ?? 0n;
      projectedBalanceMinor = principal - initialPaid - paidAsOf - projected;
      if (projectedBalanceMinor < 0n) projectedBalanceMinor = 0n;
    } else if (isPast) {
      const paidAsOf = paidByDebtAsOf.get(debt.id)?.sum ?? 0n;
      projectedBalanceMinor = principal - initialPaid - paidAsOf;
    }

    return {
      id: debt.id,
      name: debt.name,
      currency: debt.currency,
      principalMinor: principal,
      monthlyPaymentMinor: BigInt(debt.monthlyPaymentMinor as unknown as string | number | bigint),
      interestRateAnnual: debt.interestRateAnnual ? Number(debt.interestRateAnnual) : null,
      startDate: debt.startDate,
      endDate: debt.endDate,
      totalInstallments: debt.totalInstallments,
      status: debt.status as DebtState['status'],
      realBalanceMinor,
      projectedBalanceMinor,
      totalPaidMinor,
      paidInstallments,
    };
  });
}

function toVirtualRule(r: typeof recurringRules.$inferSelect): RecurringRuleForVirtuals {
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
    nextOccurrenceDate: r.nextOccurrenceDate,
    accountId: r.accountId,
    counterAccountId: r.counterAccountId,
    categoryId: r.categoryId,
    debtId: r.debtId,
    savingsGoalId: r.savingsGoalId,
    isActive: r.isActive,
  };
}
