import 'server-only';
import { and, eq, lte, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { savingsGoals, transactions } from '@/db/schema';
import type { UserId } from '@/types/ids';

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
  /** % cumplido [0..1]. */
  progress: number;
}

export async function listSavingsGoalsWithState(
  userId: UserId,
  today: string,
): Promise<SavingsGoalState[]> {
  const goals = await db.query.savingsGoals.findMany({
    where: eq(savingsGoals.userId, userId),
    orderBy: (g, { desc }) => [desc(g.createdAt)],
  });

  if (goals.length === 0) return [];

  const sums = await db
    .select({
      goalId: transactions.savingsGoalId,
      sum: sql<string | null>`COALESCE(SUM(${transactions.amountMinor}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.kind, 'savings_contribution'),
        eq(transactions.isPaid, true),
        lte(transactions.transactionDate, today),
      ),
    )
    .groupBy(transactions.savingsGoalId);

  const sumByGoal = new Map<string, bigint>();
  for (const s of sums) {
    if (s.goalId) sumByGoal.set(s.goalId, BigInt(s.sum ?? 0));
  }

  return goals.map((g) => {
    const target = BigInt(g.targetAmountMinor as unknown as string | number | bigint);
    const current = sumByGoal.get(g.id) ?? 0n;
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
      progress,
    };
  });
}

export async function getSavingsGoalState(
  userId: UserId,
  goalId: string,
  today: string,
): Promise<SavingsGoalState | null> {
  const all = await listSavingsGoalsWithState(userId, today);
  return all.find((g) => g.id === goalId) ?? null;
}
