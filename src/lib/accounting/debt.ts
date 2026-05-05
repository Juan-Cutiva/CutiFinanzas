import 'server-only';
import { and, eq, lte, sql } from 'drizzle-orm';
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

/**
 * Estado completo de una deuda, derivado de transactions.
 */
export async function getDebtState(
  userId: UserId,
  debtId: string,
  asOfDate: string,
  today: string,
): Promise<DebtState | null> {
  const debt = await db.query.debts.findFirst({
    where: and(eq(debts.id, debtId), eq(debts.userId, userId)),
  });
  if (!debt) return null;

  const principal = BigInt(debt.principalMinor as unknown as string | number | bigint);
  const initialPaid = BigInt(debt.initialPaidMinor as unknown as string | number | bigint);

  // Pagos reales hasta today
  const paidRow = await db
    .select({
      sum: sql<string | null>`COALESCE(SUM(${transactions.amountMinor}), 0)`,
      count: sql<string | null>`COUNT(*)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.debtId, debtId),
        eq(transactions.kind, 'loan_payment'),
        lte(transactions.transactionDate, today),
      ),
    );
  const totalPaidMinor = BigInt(paidRow[0]?.sum ?? 0);
  const paidInstallments = Number(paidRow[0]?.count ?? 0);
  const realBalanceMinor = principal - initialPaid - totalPaidMinor;

  // Proyección al cierre de asOfDate. Incluye:
  //   1. Pagos REALES con fecha ≤ asOfDate (incluso futuros ya registrados).
  //   2. Pagos VIRTUALES pendientes de materializar (cron aún no los creó).
  let projectedBalanceMinor = realBalanceMinor;
  if (asOfDate > today) {
    // Reales hasta asOfDate (puede incluir pagos futuros ya registrados).
    const paidUpToAsOf = await db
      .select({
        sum: sql<string | null>`COALESCE(SUM(${transactions.amountMinor}), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.debtId, debtId),
          eq(transactions.kind, 'loan_payment'),
          lte(transactions.transactionDate, asOfDate),
        ),
      );
    const totalPaidUpToAsOf = BigInt(paidUpToAsOf[0]?.sum ?? 0);

    // Virtuales pendientes de materializar (desde nextOccurrenceDate).
    const rules = await db
      .select()
      .from(recurringRules)
      .where(
        and(
          eq(recurringRules.userId, userId),
          eq(recurringRules.isActive, true),
          eq(recurringRules.debtId, debtId),
          eq(recurringRules.kind, 'loan_payment'),
        ),
      );
    let projectedPayments = 0n;
    for (const r of rules) {
      const v = generateVirtualOccurrences(toVirtualRule(r), asOfDate);
      for (const occ of v) projectedPayments += occ.amountMinor;
    }
    projectedBalanceMinor = principal - initialPaid - totalPaidUpToAsOf - projectedPayments;
    if (projectedBalanceMinor < 0n) projectedBalanceMinor = 0n;
  } else if (asOfDate < today) {
    // Saldo histórico: principal − initialPaid − pagos hasta asOfDate.
    const past = await db
      .select({
        sum: sql<string | null>`COALESCE(SUM(${transactions.amountMinor}), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.debtId, debtId),
          eq(transactions.kind, 'loan_payment'),
          lte(transactions.transactionDate, asOfDate),
        ),
      );
    projectedBalanceMinor = principal - initialPaid - BigInt(past[0]?.sum ?? 0);
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
}

export async function listDebtsWithState(
  userId: UserId,
  asOfDate: string,
  today: string,
): Promise<DebtState[]> {
  const all = await db.query.debts.findMany({
    where: eq(debts.userId, userId),
    orderBy: (d, { desc }) => [desc(d.createdAt)],
  });
  const out: DebtState[] = [];
  for (const d of all) {
    const s = await getDebtState(userId, d.id, asOfDate, today);
    if (s) out.push(s);
  }
  return out;
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
