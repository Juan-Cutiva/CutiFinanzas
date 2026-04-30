import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { accounts, savingsGoals, transactions } from '@/db/schema';
import { NotFoundError, ValidationError } from '@/lib/errors';
import type { CurrencyCode } from '@/lib/money';
import type { UserId } from '@/types/ids';
import { amountMajorToMinor, getQuincenaFromIsoDate } from '../transactions/domain';
import type { ContributeInput, SavingsGoalInput, UpdateSavingsGoalInput } from './schema';

export async function createSavingsGoal(userId: UserId, input: SavingsGoalInput) {
  const currency = input.currency as CurrencyCode;
  const [row] = await db
    .insert(savingsGoals)
    .values({
      userId,
      accountId: input.accountId ?? null,
      name: input.name,
      targetAmountMinor: amountMajorToMinor(input.targetAmount, currency),
      currentAmountMinor: amountMajorToMinor(input.currentAmount, currency),
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
  if (rest.currentAmount !== undefined)
    patch.currentAmountMinor = amountMajorToMinor(rest.currentAmount, currency);
  if (rest.monthlyContribution !== undefined)
    patch.monthlyContributionMinor = amountMajorToMinor(rest.monthlyContribution, currency);
  if (rest.startDate) patch.startDate = rest.startDate;
  if (rest.targetDate !== undefined) patch.targetDate = rest.targetDate;
  if (rest.icon) patch.icon = rest.icon;
  if (rest.color) patch.color = rest.color;
  if (rest.notes !== undefined) patch.notes = rest.notes;
  if (rest.accountId !== undefined) patch.accountId = rest.accountId;

  const [row] = await db
    .update(savingsGoals)
    .set(patch)
    .where(and(eq(savingsGoals.userId, userId), eq(savingsGoals.id, id)))
    .returning();
  if (!row) throw new NotFoundError('Meta');
  return row;
}

export async function contributeToGoal(userId: UserId, input: ContributeInput) {
  const existing = await db.query.savingsGoals.findFirst({
    where: and(eq(savingsGoals.userId, userId), eq(savingsGoals.id, input.id)),
  });
  if (!existing) throw new NotFoundError('Meta');

  const account = await db.query.accounts.findFirst({
    where: and(eq(accounts.userId, userId), eq(accounts.id, input.accountId)),
  });
  if (!account) throw new ValidationError('Cuenta inválida');
  if (account.currency !== existing.currency) {
    throw new ValidationError(
      `La cuenta usa ${account.currency} y la meta usa ${existing.currency}; convierte primero o usa otra cuenta.`,
    );
  }

  const currency = existing.currency as CurrencyCode;
  const inc = amountMajorToMinor(input.amount, currency);
  const newAmount = (existing.currentAmountMinor as bigint) + inc;
  const reachedTarget = newAmount >= (existing.targetAmountMinor as bigint);
  const occurredAt = input.occurredAt ?? new Date().toISOString().slice(0, 10);

  await db.insert(transactions).values({
    userId,
    accountId: input.accountId,
    categoryId: null,
    kind: 'savings_contribution',
    amountMinor: inc,
    currency: account.currency,
    occurredAt,
    description: `Aporte a ${existing.name}`,
    isPaid: true,
    quincena: getQuincenaFromIsoDate(occurredAt),
  });

  const [row] = await db
    .update(savingsGoals)
    .set({
      currentAmountMinor: newAmount,
      status: reachedTarget ? 'achieved' : 'active',
      updatedAt: sql`now()`,
    })
    .where(and(eq(savingsGoals.userId, userId), eq(savingsGoals.id, input.id)))
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
