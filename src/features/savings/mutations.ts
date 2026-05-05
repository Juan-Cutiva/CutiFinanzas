import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { savingsGoals } from '@/db/schema';
import { NotFoundError } from '@/lib/errors';
import type { CurrencyCode } from '@/lib/money';
import type { UserId } from '@/types/ids';
import { amountMajorToMinor } from '../transactions/domain';
import type { SavingsGoalInput, UpdateSavingsGoalInput } from './schema';

export async function createSavingsGoal(userId: UserId, input: SavingsGoalInput) {
  const currency = input.currency as CurrencyCode;
  const [row] = await db
    .insert(savingsGoals)
    .values({
      userId,
      accountId: input.accountId ?? null,
      name: input.name,
      targetAmountMinor: amountMajorToMinor(input.targetAmount, currency),
      monthlyContributionMinor: amountMajorToMinor(input.monthlyContribution, currency),
      currency,
      startDate: input.startDate,
      targetDate: input.targetDate ?? null,
      icon: input.icon,
      color: input.color,
      notes: input.notes ?? null,
    })
    .returning();
  if (!row) throw new Error('No se pudo crear la meta de ahorro');
  return row;
}

export async function updateSavingsGoal(userId: UserId, input: UpdateSavingsGoalInput) {
  const { id, ...rest } = input;
  const existing = await db.query.savingsGoals.findFirst({
    where: and(eq(savingsGoals.userId, userId), eq(savingsGoals.id, id)),
  });
  if (!existing) throw new NotFoundError('Meta');

  const currency = (rest.currency ?? existing.currency) as CurrencyCode;
  const patch: Record<string, unknown> = { updatedAt: sql`now()` };
  if (rest.name) patch.name = rest.name;
  if (rest.targetAmount !== undefined)
    patch.targetAmountMinor = amountMajorToMinor(rest.targetAmount, currency);
  if (rest.monthlyContribution !== undefined)
    patch.monthlyContributionMinor = amountMajorToMinor(rest.monthlyContribution, currency);
  if (rest.startDate) patch.startDate = rest.startDate;
  if (rest.targetDate !== undefined) patch.targetDate = rest.targetDate;
  if (rest.icon) patch.icon = rest.icon;
  if (rest.color) patch.color = rest.color;
  if (rest.notes !== undefined) patch.notes = rest.notes;
  if (rest.accountId !== undefined) patch.accountId = rest.accountId;
  if (rest.status !== undefined) patch.status = rest.status;

  const [row] = await db
    .update(savingsGoals)
    .set(patch)
    .where(and(eq(savingsGoals.userId, userId), eq(savingsGoals.id, id)))
    .returning();
  if (!row) throw new NotFoundError('Meta');
  return row;
}

export async function deleteSavingsGoal(userId: UserId, id: string) {
  const [row] = await db
    .delete(savingsGoals)
    .where(and(eq(savingsGoals.userId, userId), eq(savingsGoals.id, id)))
    .returning();
  if (!row) throw new NotFoundError('Meta');
  return row;
}
