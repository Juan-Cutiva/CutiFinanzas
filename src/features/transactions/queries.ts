import 'server-only';
import { and, between, desc, eq, sum } from 'drizzle-orm';
import { db } from '@/db/client';
import { transactions } from '@/db/schema';
import type { UserId } from '@/types/ids';

function monthRange(year: number, month: number): { from: string; to: string } {
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

export async function listTransactionsByMonth(userId: UserId, year: number, month: number) {
  const { from, to } = monthRange(year, month);
  return db.query.transactions.findMany({
    where: and(eq(transactions.userId, userId), between(transactions.occurredAt, from, to)),
    with: {
      account: true,
      transferAccount: true,
      category: true,
    },
    orderBy: [desc(transactions.occurredAt), desc(transactions.createdAt)],
  });
}

export async function totalsByMonth(userId: UserId, year: number, month: number) {
  const { from, to } = monthRange(year, month);
  const rows = await db
    .select({
      kind: transactions.kind,
      total: sum(transactions.amountMinor).mapWith(Number),
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), between(transactions.occurredAt, from, to)))
    .groupBy(transactions.kind);

  const map: Record<string, number> = {};
  for (const r of rows) map[r.kind] = r.total ?? 0;
  return {
    incomeMinor: map.income ?? 0,
    expenseFixedMinor: map.expense_fixed ?? 0,
    expenseVariableMinor: map.expense_variable ?? 0,
    debtPaymentMinor: map.debt_payment ?? 0,
    savingsContributionMinor: map.savings_contribution ?? 0,
  };
}

export async function totalsByCategoryByMonth(userId: UserId, year: number, month: number) {
  const { from, to } = monthRange(year, month);
  const rows = await db
    .select({
      categoryId: transactions.categoryId,
      total: sum(transactions.amountMinor).mapWith(Number),
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), between(transactions.occurredAt, from, to)))
    .groupBy(transactions.categoryId);
  return rows;
}
