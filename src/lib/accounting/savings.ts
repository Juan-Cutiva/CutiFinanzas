import 'server-only';
import { and, eq, inArray, isNotNull, lte, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { recurringRules, savingsGoals, transactions } from '@/db/schema';
import type { UserId } from '@/types/ids';
import { generateVirtualOccurrences, type RecurringRuleForVirtuals } from './virtuals';

export interface SavingsGoalState {
  id: string;
  name: string;
  currency: string;
  targetAmountMinor: bigint;
  monthlyContributionMinor: bigint;
  startDate: string;
  targetDate: string | null;
  icon: string;
  color: string;
  status: 'active' | 'achieved' | 'paused' | 'cancelled';
  /** Aportado real (suma de savings_contribution para esta meta hasta today). */
  currentAmountMinor: bigint;
  /**
   * Aportado proyectado al día `asOfDate` (real al asOfDate + aportes virtuales
   * de reglas recurrentes pendientes entre today y asOfDate).
   * Si asOfDate ≤ today, es igual a currentAmountMinor.
   */
  projectedAmountMinor: bigint;
  /** % cumplido al día today [0..1]. */
  progress: number;
}

/**
 * Suma agregada de savings_contribution por goal hasta `asOfDate`.
 */
async function sumContributionsByGoal(
  userId: UserId,
  goalIds: string[],
  asOfDate: string,
): Promise<Map<string, bigint>> {
  if (goalIds.length === 0) return new Map();
  const rows = await db
    .select({
      goalId: transactions.savingsGoalId,
      sum: sql<string | null>`COALESCE(SUM(${transactions.amountMinor}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        inArray(transactions.savingsGoalId, goalIds),
        eq(transactions.kind, 'savings_contribution'),
        lte(transactions.transactionDate, asOfDate),
      ),
    )
    .groupBy(transactions.savingsGoalId);

  const out = new Map<string, bigint>();
  for (const r of rows) {
    if (r.goalId) out.set(r.goalId, BigInt(r.sum ?? 0));
  }
  return out;
}

/**
 * Set de (ruleId, date) ya materializadas como savings_contribution con
 * date ≤ asOfDate para los goals indicados. Sin acotar por fecha inferior:
 * `generateVirtualOccurrences` parte de `nextOccurrenceDate` que puede quedar
 * atrasado si el cron crasheó entre el insert y la actualización de la regla.
 */
async function materializedContributionKeys(
  userId: UserId,
  goalIds: string[],
  asOfDate: string,
): Promise<Set<string>> {
  if (goalIds.length === 0) return new Set();
  const rows = await db
    .select({ ruleId: transactions.recurringRuleId, date: transactions.transactionDate })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        inArray(transactions.savingsGoalId, goalIds),
        eq(transactions.kind, 'savings_contribution'),
        lte(transactions.transactionDate, asOfDate),
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
 * Lista todas las metas con saldo real (today) y proyectado (asOfDate).
 *
 * Si `asOfDate` es omitido o ≤ today, no se calcula proyección — `projectedAmountMinor`
 * queda igual a `currentAmountMinor`.
 */
export async function listSavingsGoalsWithState(
  userId: UserId,
  today: string,
  asOfDate?: string,
): Promise<SavingsGoalState[]> {
  const goals = await db.query.savingsGoals.findMany({
    where: eq(savingsGoals.userId, userId),
    orderBy: (g, { desc }) => [desc(g.createdAt)],
  });
  if (goals.length === 0) return [];

  const goalIds = goals.map((g) => g.id);
  const isFuture = !!asOfDate && asOfDate > today;

  const [todaySums, asOfSums, rules, matSet] = await Promise.all([
    sumContributionsByGoal(userId, goalIds, today),
    isFuture
      ? sumContributionsByGoal(userId, goalIds, asOfDate)
      : Promise.resolve(new Map<string, bigint>()),
    isFuture
      ? db
          .select()
          .from(recurringRules)
          .where(
            and(
              eq(recurringRules.userId, userId),
              eq(recurringRules.isActive, true),
              eq(recurringRules.kind, 'savings_contribution'),
              inArray(recurringRules.savingsGoalId, goalIds),
            ),
          )
      : Promise.resolve([] as (typeof recurringRules.$inferSelect)[]),
    isFuture
      ? materializedContributionKeys(userId, goalIds, asOfDate)
      : Promise.resolve(new Set<string>()),
  ]);

  // Sum virtual contributions per goal (excluding materialized).
  const virtualByGoal = new Map<string, bigint>();
  if (isFuture) {
    for (const r of rules) {
      if (!r.savingsGoalId) continue;
      const ruleVirt = ruleToVirtual(r);
      const virtuals = generateVirtualOccurrences(ruleVirt, asOfDate);
      let acc = virtualByGoal.get(r.savingsGoalId) ?? 0n;
      for (const v of virtuals) {
        if (matSet.has(`${r.id}:${v.transactionDate}`)) continue;
        acc += v.amountMinor;
      }
      virtualByGoal.set(r.savingsGoalId, acc);
    }
  }

  return goals.map((g) => {
    const target = BigInt(g.targetAmountMinor as unknown as string | number | bigint);
    const current = todaySums.get(g.id) ?? 0n;
    let projected = current;
    if (isFuture) {
      const realAtAsOf = asOfSums.get(g.id) ?? current;
      projected = realAtAsOf + (virtualByGoal.get(g.id) ?? 0n);
    }
    const progress = target === 0n ? 0 : Math.min(1, Number(current) / Number(target));
    return {
      id: g.id,
      name: g.name,
      currency: g.currency,
      targetAmountMinor: target,
      monthlyContributionMinor: BigInt(
        g.monthlyContributionMinor as unknown as string | number | bigint,
      ),
      startDate: g.startDate,
      targetDate: g.targetDate,
      icon: g.icon,
      color: g.color,
      status: g.status as SavingsGoalState['status'],
      currentAmountMinor: current,
      projectedAmountMinor: projected,
      progress,
    };
  });
}

export async function getSavingsGoalState(
  userId: UserId,
  goalId: string,
  today: string,
  asOfDate?: string,
): Promise<SavingsGoalState | null> {
  const all = await listSavingsGoalsWithState(userId, today, asOfDate);
  return all.find((g) => g.id === goalId) ?? null;
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
