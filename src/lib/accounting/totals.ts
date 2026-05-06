import 'server-only';
import { and, between, eq, inArray, or, sql } from 'drizzle-orm';
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
 * Suma totales del rango [from, to] inclusive.
 *
 * MODOS:
 * - Sin `accountId` (default global): `incomeMinor` = sum INCOME_KINDS,
 *   `expenseMinor` = sum EXPENSE_KINDS. Las transferencias internas no cuentan
 *   en ninguno (son flujos internos del usuario).
 * - Con `accountId` (vista por cuenta): `incomeMinor` = lo que ENTRÓ a esa
 *   cuenta (income, refund, transfer-in, cc_charge si la cuenta es CC),
 *   `expenseMinor` = lo que SALIÓ de esa cuenta (expense, transfer-out,
 *   cc_payment, loan_payment, savings_contribution). El balance neto refleja
 *   el delta REAL de esa cuenta en el período — útil para "balance por
 *   quincena de mi nómina" donde transferencias salientes SÍ deben restar.
 *
 * `includeVirtuals`: agrega ocurrencias futuras de reglas recurrentes (no
 * materializadas aún por el cron) hasta `to`, partiendo de `today`.
 */
export async function getPeriodTotals(
  userId: UserId,
  from: string,
  to: string,
  options: {
    includeVirtuals?: boolean;
    today?: string;
    accountId?: string;
  } = {},
): Promise<PeriodTotals> {
  const { includeVirtuals = false, today, accountId } = options;
  const byKind = emptyByKind();

  if (accountId) {
    return getPeriodTotalsForAccount(userId, from, to, accountId, includeVirtuals, today);
  }

  // GLOBAL: agrupar por kind, sumar income/expense por buckets.
  const realRows = await db
    .select({
      kind: transactions.kind,
      sum: sql<string | null>`COALESCE(SUM(${transactions.amountMinor}), 0)`,
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), between(transactions.transactionDate, from, to)))
    .groupBy(transactions.kind);

  for (const r of realRows) {
    byKind[r.kind as TransactionKind] = BigInt(r.sum ?? 0);
  }

  if (includeVirtuals && today) {
    const rules = await db
      .select()
      .from(recurringRules)
      .where(and(eq(recurringRules.userId, userId), eq(recurringRules.isActive, true)));
    for (const r of rules) {
      const rule = ruleToVirtual(r);
      const occurrences = generateVirtualOccurrences(rule, to, from);
      for (const v of occurrences) {
        byKind[v.kind] += v.amountMinor;
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
 * Vista por cuenta específica: cuenta TODOS los flujos que afectan esa cuenta,
 * incluyendo transferencias salientes y entrantes. El balance resultado refleja
 * el delta de saldo de la cuenta en el período.
 */
async function getPeriodTotalsForAccount(
  userId: UserId,
  from: string,
  to: string,
  accountId: string,
  includeVirtuals: boolean,
  today: string | undefined,
): Promise<PeriodTotals> {
  const byKind = emptyByKind();

  // Sumas por kind cuando la cuenta es ORIGEN (accountId).
  const principalRows = await db
    .select({
      kind: transactions.kind,
      sum: sql<string | null>`COALESCE(SUM(${transactions.amountMinor}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        between(transactions.transactionDate, from, to),
        eq(transactions.accountId, accountId),
      ),
    )
    .groupBy(transactions.kind);

  // Sumas por kind cuando la cuenta es DESTINO (counterAccountId).
  const counterRows = await db
    .select({
      kind: transactions.kind,
      sum: sql<string | null>`COALESCE(SUM(${transactions.amountMinor}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        between(transactions.transactionDate, from, to),
        eq(transactions.counterAccountId, accountId),
      ),
    )
    .groupBy(transactions.kind);

  let moneyIn = 0n;
  let moneyOut = 0n;

  for (const r of principalRows) {
    const sum = BigInt(r.sum ?? 0);
    const kind = r.kind as TransactionKind;
    byKind[kind] += sum;
    moneyIn += originDeltaIn(kind, sum);
    moneyOut += originDeltaOut(kind, sum);
  }
  for (const r of counterRows) {
    const sum = BigInt(r.sum ?? 0);
    const kind = r.kind as TransactionKind;
    byKind[kind] += sum;
    moneyIn += counterDeltaIn(kind, sum);
    moneyOut += counterDeltaOut(kind, sum);
  }

  if (includeVirtuals && today) {
    const ruleFilter = or(
      eq(recurringRules.accountId, accountId),
      eq(recurringRules.counterAccountId, accountId),
    );
    const ruleConds = [eq(recurringRules.userId, userId), eq(recurringRules.isActive, true)];
    if (ruleFilter) ruleConds.push(ruleFilter);
    const rules = await db
      .select()
      .from(recurringRules)
      .where(and(...ruleConds));
    for (const r of rules) {
      const rule = ruleToVirtual(r);
      const occurrences = generateVirtualOccurrences(rule, to, from);
      for (const v of occurrences) {
        byKind[v.kind] += v.amountMinor;
        if (v.accountId === accountId) {
          moneyIn += originDeltaIn(v.kind, v.amountMinor);
          moneyOut += originDeltaOut(v.kind, v.amountMinor);
        } else if (v.counterAccountId === accountId) {
          moneyIn += counterDeltaIn(v.kind, v.amountMinor);
          moneyOut += counterDeltaOut(v.kind, v.amountMinor);
        }
      }
    }
  }

  return {
    incomeMinor: moneyIn,
    expenseMinor: moneyOut,
    savingsMinor: byKind.savings_contribution,
    byKind,
  };
}

// === Helpers para clasificar in/out desde la perspectiva de UNA cuenta ===
//
// Cuando la cuenta es ORIGEN (accountId):
function originDeltaIn(kind: TransactionKind, amount: bigint): bigint {
  // income/refund llegan a la cuenta. cc_charge solo aplica si la cuenta es CC.
  if (kind === 'income' || kind === 'refund' || kind === 'cc_charge') return amount;
  return 0n;
}
function originDeltaOut(kind: TransactionKind, amount: bigint): bigint {
  // expense, transfer (out), cc_payment, loan_payment, savings_contribution salen.
  if (
    kind === 'expense' ||
    kind === 'transfer' ||
    kind === 'cc_payment' ||
    kind === 'loan_payment' ||
    kind === 'savings_contribution'
  ) {
    return amount;
  }
  return 0n;
}

// Cuando la cuenta es DESTINO (counterAccountId):
function counterDeltaIn(kind: TransactionKind, amount: bigint): bigint {
  // transfer-in: entra dinero a la cuenta destino.
  if (kind === 'transfer') return amount;
  return 0n;
}
function counterDeltaOut(kind: TransactionKind, amount: bigint): bigint {
  // cc_payment: la CC destino reduce su deuda (= sale "deuda" de la CC).
  if (kind === 'cc_payment') return amount;
  return 0n;
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
    nextOccurrenceDate: r.nextOccurrenceDate,
    accountId: r.accountId,
    counterAccountId: r.counterAccountId,
    categoryId: r.categoryId,
    debtId: r.debtId,
    savingsGoalId: r.savingsGoalId,
    isActive: r.isActive,
  };
}
