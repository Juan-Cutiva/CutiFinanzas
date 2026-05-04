import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { budgets } from '@/db/schema';
import { NotFoundError, ValidationError } from '@/lib/errors';
import type { CurrencyCode } from '@/lib/money';
import type { UserId } from '@/types/ids';
import { amountMajorToMinor } from '../transactions/domain';
import type { BudgetInput, UpdateBudgetInput, UpdateRecurringBudgetInput } from './schema';

export async function upsertBudget(userId: UserId, input: BudgetInput) {
  const amountMinor = amountMajorToMinor(input.amount, input.currency as CurrencyCode);
  const [row] = await db
    .insert(budgets)
    .values({
      userId,
      categoryId: input.categoryId,
      year: input.year,
      month: input.month,
      period: input.period,
      amountMinor,
      currency: input.currency,
      notes: input.notes ?? null,
    })
    .onConflictDoUpdate({
      target: [budgets.userId, budgets.categoryId, budgets.year, budgets.month, budgets.period],
      set: { amountMinor, notes: input.notes ?? null, updatedAt: sql`now()` },
    })
    .returning();
  if (!row) throw new Error('No se pudo guardar el presupuesto');
  return row;
}

export async function updateBudget(userId: UserId, input: UpdateBudgetInput) {
  const { id, amount, notes } = input;
  const patch: Record<string, unknown> = { updatedAt: sql`now()` };
  if (amount !== undefined) {
    const existing = await db.query.budgets.findFirst({
      where: and(eq(budgets.userId, userId), eq(budgets.id, id)),
    });
    if (!existing) throw new NotFoundError('Presupuesto');
    patch.amountMinor = amountMajorToMinor(amount, existing.currency as CurrencyCode);
  }
  if (notes !== undefined) patch.notes = notes;

  const [row] = await db
    .update(budgets)
    .set(patch)
    .where(and(eq(budgets.userId, userId), eq(budgets.id, id)))
    .returning();
  if (!row) throw new NotFoundError('Presupuesto');
  return row;
}

export async function updateRecurringBudget(userId: UserId, input: UpdateRecurringBudgetInput) {
  let categoryId: string;
  let year: number;
  let month: number;
  let period: 'monthly' | 'quincena_1' | 'quincena_2';
  let currency: string;

  if (input.id.startsWith('virtual:')) {
    const parts = input.id.split(':');
    if (parts.length < 3) throw new ValidationError('Identificador inválido');
    const ruleId = parts[1] as string;
    const ym = parts.slice(2).join(':');
    const [yStr, mStr] = ym.split('-');
    if (!yStr || !mStr) throw new ValidationError('Identificador inválido');

    const rule = await db.query.budgets.findFirst({
      where: and(eq(budgets.userId, userId), eq(budgets.id, ruleId)),
    });
    if (!rule) throw new NotFoundError('Presupuesto');
    categoryId = rule.categoryId;
    year = Number.parseInt(yStr, 10);
    month = Number.parseInt(mStr, 10);
    period = rule.period;
    currency = rule.currency;
  } else {
    const existing = await db.query.budgets.findFirst({
      where: and(eq(budgets.userId, userId), eq(budgets.id, input.id)),
    });
    if (!existing) throw new NotFoundError('Presupuesto');
    categoryId = existing.categoryId;
    year = existing.year;
    month = existing.month;
    period = existing.period;
    currency = existing.currency;
  }

  const amountMinor = amountMajorToMinor(input.amount, currency as CurrencyCode);
  const isRecurring = input.mode === 'forward';

  const [row] = await db
    .insert(budgets)
    .values({
      userId,
      categoryId,
      year,
      month,
      period,
      amountMinor,
      currency,
      isRecurring,
      notes: input.notes ?? null,
    })
    .onConflictDoUpdate({
      target: [budgets.userId, budgets.categoryId, budgets.year, budgets.month, budgets.period],
      set: {
        amountMinor,
        isRecurring,
        notes: input.notes ?? null,
        updatedAt: sql`now()`,
      },
    })
    .returning();
  if (!row) throw new Error('No se pudo guardar el presupuesto');
  return row;
}

export async function deleteBudget(userId: UserId, id: string) {
  const [row] = await db
    .delete(budgets)
    .where(and(eq(budgets.userId, userId), eq(budgets.id, id)))
    .returning();
  if (!row) throw new NotFoundError('Presupuesto');
  return row;
}
