import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { accounts, debts, savingsGoals, transactions } from '@/db/schema';
import { NotFoundError, ValidationError } from '@/lib/errors';
import type { CurrencyCode } from '@/lib/money';
import type { UserId } from '@/types/ids';
import { amountMajorToMinor, getQuincenaFromIsoDate } from './domain';
import type { TransactionInput, UpdateTransactionInput } from './schema';

export async function createTransaction(userId: UserId, input: TransactionInput) {
  const account = await db.query.accounts.findFirst({
    where: and(eq(accounts.userId, userId), eq(accounts.id, input.accountId)),
  });
  if (!account) throw new ValidationError('Cuenta inválida');
  if (account.currency !== input.currency) {
    throw new ValidationError(
      `La cuenta usa ${account.currency}; conviértelo o elige otra cuenta.`,
    );
  }
  if (input.transferAccountId) {
    const destination = await db.query.accounts.findFirst({
      where: and(eq(accounts.userId, userId), eq(accounts.id, input.transferAccountId)),
    });
    if (!destination) throw new ValidationError('Cuenta destino inválida');
  }

  const amountMinor = amountMajorToMinor(input.amount, input.currency as CurrencyCode);
  const quincena = getQuincenaFromIsoDate(input.occurredAt);

  const [row] = await db
    .insert(transactions)
    .values({
      userId,
      accountId: input.accountId,
      transferAccountId: input.transferAccountId ?? null,
      categoryId: input.categoryId ?? null,
      kind: input.kind,
      amountMinor,
      currency: input.currency,
      occurredAt: input.occurredAt,
      description: input.description ?? null,
      notes: input.notes ?? null,
      isPaid: input.isPaid,
      receiptUrl: input.receiptUrl ?? null,
      quincena,
    })
    .returning();
  if (!row) throw new Error('No se pudo registrar la transacción');

  if (input.kind === 'debt_payment' && input.debtId) {
    await db
      .update(debts)
      .set({
        currentBalanceMinor: sql`GREATEST(0::bigint, ${debts.currentBalanceMinor} - ${amountMinor.toString()}::bigint)`,
        paidInstallments: sql`${debts.paidInstallments} + 1`,
        updatedAt: sql`now()`,
      })
      .where(and(eq(debts.userId, userId), eq(debts.id, input.debtId)));
  }

  if (input.kind === 'savings_contribution' && input.savingsGoalId) {
    await db
      .update(savingsGoals)
      .set({
        currentAmountMinor: sql`${savingsGoals.currentAmountMinor} + ${amountMinor.toString()}::bigint`,
        updatedAt: sql`now()`,
      })
      .where(and(eq(savingsGoals.userId, userId), eq(savingsGoals.id, input.savingsGoalId)));
  }

  return row;
}

export async function updateTransaction(userId: UserId, input: UpdateTransactionInput) {
  const { id, ...patch } = input;
  const [row] = await db
    .update(transactions)
    .set({ ...patch, updatedAt: sql`now()` })
    .where(and(eq(transactions.userId, userId), eq(transactions.id, id)))
    .returning();
  if (!row) throw new NotFoundError('Transacción');
  return row;
}

export async function deleteTransaction(userId: UserId, id: string) {
  const [row] = await db
    .delete(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.id, id)))
    .returning();
  if (!row) throw new NotFoundError('Transacción');
  return row;
}
