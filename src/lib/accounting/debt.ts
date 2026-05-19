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

interface DebtMovementTotals {
  /** Suma de pagos (loan_payment) que reducen el saldo. */
  paymentsSum: bigint;
  /** Cuántas cuotas se han pagado (count de loan_payment). */
  paymentsCount: number;
  /** Suma de cargos extra (loan_charge) que aumentan el saldo. */
  chargesSum: bigint;
}

/**
 * Suma agregada de movimientos por deuda hasta `asOfDate`. Devuelve un Map.
 * Separa pagos y cargos para poder mostrar conteos correctamente; el saldo
 * neto se calcula afuera (principal − initialPaid − payments + charges).
 */
async function sumDebtMovementsByDebt(
  userId: UserId,
  debtIds: string[],
  asOfDate: string,
): Promise<Map<string, DebtMovementTotals>> {
  if (debtIds.length === 0) return new Map();
  const rows = await db
    .select({
      debtId: transactions.debtId,
      paymentsSum: sql<
        string | null
      >`COALESCE(SUM(${transactions.amountMinor}) FILTER (WHERE ${transactions.kind} = 'loan_payment'), 0)`,
      paymentsCount: sql<
        string | null
      >`COUNT(*) FILTER (WHERE ${transactions.kind} = 'loan_payment')`,
      chargesSum: sql<
        string | null
      >`COALESCE(SUM(${transactions.amountMinor}) FILTER (WHERE ${transactions.kind} = 'loan_charge'), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        inArray(transactions.debtId, debtIds),
        inArray(transactions.kind, ['loan_payment', 'loan_charge']),
        lte(transactions.transactionDate, asOfDate),
      ),
    )
    .groupBy(transactions.debtId);

  const out = new Map<string, DebtMovementTotals>();
  for (const r of rows) {
    if (r.debtId) {
      out.set(r.debtId, {
        paymentsSum: BigInt(r.paymentsSum ?? 0),
        paymentsCount: Number(r.paymentsCount ?? 0),
        chargesSum: BigInt(r.chargesSum ?? 0),
      });
    }
  }
  return out;
}

/**
 * Set de (ruleId, date) ya materializadas como loan_payment o loan_charge en
 * (today, asOfDate] para los debts indicados. Sirve para no contar virtuales
 * cuando ya existen como reales (edit puntual o cron).
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
        inArray(transactions.kind, ['loan_payment', 'loan_charge']),
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

  const [movsToday, movsAsOf, rules, matSet] = await Promise.all([
    sumDebtMovementsByDebt(userId, debtIds, today),
    isFuture || isPast
      ? sumDebtMovementsByDebt(userId, debtIds, asOfDate)
      : Promise.resolve(new Map<string, DebtMovementTotals>()),
    isFuture
      ? db
          .select()
          .from(recurringRules)
          .where(
            and(
              eq(recurringRules.userId, userId),
              eq(recurringRules.isActive, true),
              inArray(recurringRules.kind, ['loan_payment', 'loan_charge']),
              inArray(recurringRules.debtId, debtIds),
            ),
          )
      : Promise.resolve([] as (typeof recurringRules.$inferSelect)[]),
    isFuture
      ? materializedLoanKeys(userId, debtIds, today, asOfDate)
      : Promise.resolve(new Set<string>()),
  ]);

  // Pre-genera ocurrencias virtuales por regla. Mapea pagos y cargos por debtId.
  // Los pagos REDUCEN la deuda proyectada; los cargos la AUMENTAN.
  const projectedDeltaByDebt = new Map<string, bigint>(); // delta = charges - payments
  if (isFuture) {
    for (const r of rules) {
      if (!r.debtId) continue;
      const ruleVirt = toVirtualRule(r);
      const virtuals = generateVirtualOccurrences(ruleVirt, asOfDate);
      let acc = projectedDeltaByDebt.get(r.debtId) ?? 0n;
      for (const v of virtuals) {
        if (matSet.has(`${r.id}:${v.transactionDate}`)) continue;
        if (r.kind === 'loan_payment') acc -= v.amountMinor;
        else if (r.kind === 'loan_charge') acc += v.amountMinor;
      }
      projectedDeltaByDebt.set(r.debtId, acc);
    }
  }

  return all.map((debt) => {
    const principal = BigInt(debt.principalMinor as unknown as string | number | bigint);
    const initialPaid = BigInt(debt.initialPaidMinor as unknown as string | number | bigint);

    const movToday = movsToday.get(debt.id) ?? {
      paymentsSum: 0n,
      paymentsCount: 0,
      chargesSum: 0n,
    };
    const totalPaidMinor = movToday.paymentsSum;
    const paidInstallments = movToday.paymentsCount;
    // Saldo real = principal − initialPaid − pagos + cargos extra.
    const realBalanceMinor = principal - initialPaid - totalPaidMinor + movToday.chargesSum;

    let projectedBalanceMinor = realBalanceMinor;
    if (isFuture) {
      const movAsOf = movsAsOf.get(debt.id) ?? {
        paymentsSum: 0n,
        paymentsCount: 0,
        chargesSum: 0n,
      };
      const virtualDelta = projectedDeltaByDebt.get(debt.id) ?? 0n;
      projectedBalanceMinor =
        principal - initialPaid - movAsOf.paymentsSum + movAsOf.chargesSum + virtualDelta;
      if (projectedBalanceMinor < 0n) projectedBalanceMinor = 0n;
    } else if (isPast) {
      const movAsOf = movsAsOf.get(debt.id) ?? {
        paymentsSum: 0n,
        paymentsCount: 0,
        chargesSum: 0n,
      };
      projectedBalanceMinor = principal - initialPaid - movAsOf.paymentsSum + movAsOf.chargesSum;
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
