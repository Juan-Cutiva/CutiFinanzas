import 'server-only';
import { and, between, desc, eq, inArray, sql } from 'drizzle-orm';
import { cache } from 'react';
import { db } from '@/db/client';
import { recurringRules, transactions } from '@/db/schema';
import { EXPENSE_KINDS, INCOME_KINDS, monthRange, type TransactionKind } from '@/lib/accounting';
import type { UserId } from '@/types/ids';

export const listTransactionsInRange = cache(async function listTransactionsInRange(
  userId: UserId,
  fromIso: string,
  toIso: string,
) {
  return db.query.transactions.findMany({
    where: and(
      eq(transactions.userId, userId),
      between(transactions.transactionDate, fromIso, toIso),
    ),
    with: {
      account: true,
      counterAccount: true,
      category: true,
      debt: true,
      savingsGoal: true,
      recurringRule: true,
    },
    orderBy: [desc(transactions.transactionDate), desc(transactions.createdAt)],
  });
});

export async function listTransactionsByMonth(userId: UserId, year: number, month: number) {
  const { from, to } = monthRange(year, month);
  return listTransactionsInRange(userId, from, to);
}

export async function listIncomeByMonth(userId: UserId, year: number, month: number) {
  const { from, to } = monthRange(year, month);
  return db.query.transactions.findMany({
    where: and(
      eq(transactions.userId, userId),
      inArray(transactions.kind, INCOME_KINDS as TransactionKind[]),
      between(transactions.transactionDate, from, to),
    ),
    with: { account: true, category: true, recurringRule: true },
    orderBy: [desc(transactions.transactionDate), desc(transactions.createdAt)],
  });
}

export async function listExpenseByMonth(userId: UserId, year: number, month: number) {
  const { from, to } = monthRange(year, month);
  return db.query.transactions.findMany({
    where: and(
      eq(transactions.userId, userId),
      inArray(transactions.kind, EXPENSE_KINDS as TransactionKind[]),
      between(transactions.transactionDate, from, to),
    ),
    with: { account: true, category: true, debt: true, recurringRule: true },
    orderBy: [desc(transactions.transactionDate), desc(transactions.createdAt)],
  });
}

export async function listCreditCardChargesByMonth(
  userId: UserId,
  ccAccountId: string,
  year: number,
  month: number,
) {
  const { from, to } = monthRange(year, month);
  return db.query.transactions.findMany({
    where: and(
      eq(transactions.userId, userId),
      eq(transactions.accountId, ccAccountId),
      eq(transactions.kind, 'cc_charge'),
      between(transactions.transactionDate, from, to),
    ),
    with: { account: true, category: true, recurringRule: true },
    orderBy: [desc(transactions.transactionDate), desc(transactions.createdAt)],
  });
}

/**
 * Lista todos los movimientos asociados a una deuda — pagos (loan_payment) y
 * cargos extra (loan_charge) — para el historial en la página de detalle.
 */
export async function listMovementsForDebt(userId: UserId, debtId: string) {
  return db.query.transactions.findMany({
    where: and(
      eq(transactions.userId, userId),
      inArray(transactions.kind, ['loan_payment', 'loan_charge']),
      eq(transactions.debtId, debtId),
    ),
    with: { account: true, recurringRule: true },
    orderBy: [desc(transactions.transactionDate), desc(transactions.createdAt)],
  });
}

/** @deprecated Use listMovementsForDebt — incluye cargos extra además de pagos. */
export const listPaymentsForDebt = listMovementsForDebt;

/**
 * Lista todos los aportes (savings_contribution) a una meta de ahorro —
 * para el historial en la página de detalle de la meta.
 */
export async function listContributionsForGoal(userId: UserId, goalId: string) {
  return db.query.transactions.findMany({
    where: and(
      eq(transactions.userId, userId),
      eq(transactions.kind, 'savings_contribution'),
      eq(transactions.savingsGoalId, goalId),
    ),
    with: { account: true, recurringRule: true },
    orderBy: [desc(transactions.transactionDate), desc(transactions.createdAt)],
  });
}

export async function listTransactionsByAccount(
  userId: UserId,
  accountId: string,
  fromIso: string,
  toIso: string,
) {
  return db.query.transactions.findMany({
    where: and(
      eq(transactions.userId, userId),
      between(transactions.transactionDate, fromIso, toIso),
      sql`(${transactions.accountId} = ${accountId} OR ${transactions.counterAccountId} = ${accountId})`,
    ),
    with: { account: true, counterAccount: true, category: true, debt: true, recurringRule: true },
    orderBy: [desc(transactions.transactionDate), desc(transactions.createdAt)],
  });
}

export async function getTransactionById(userId: UserId, id: string) {
  return db.query.transactions.findFirst({
    where: and(eq(transactions.id, id), eq(transactions.userId, userId)),
    with: {
      account: true,
      counterAccount: true,
      category: true,
      debt: true,
      savingsGoal: true,
      recurringRule: true,
    },
  });
}

export async function listActiveRecurringRules(userId: UserId) {
  return db.query.recurringRules.findMany({
    where: and(eq(recurringRules.userId, userId), eq(recurringRules.isActive, true)),
    orderBy: (r, { asc }) => [asc(r.name)],
  });
}
