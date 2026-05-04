import 'server-only';
import { and, asc, eq, ne } from 'drizzle-orm';
import { db } from '@/db/client';
import { debts, transactions } from '@/db/schema';
import type { UserId } from '@/types/ids';

export async function listDebtsByUser(userId: UserId) {
  return db
    .select()
    .from(debts)
    .where(and(eq(debts.userId, userId), ne(debts.status, 'paid_off')))
    .orderBy(asc(debts.endDate), asc(debts.name));
}

export async function getDebtById(userId: UserId, id: string) {
  return db.query.debts.findFirst({ where: and(eq(debts.userId, userId), eq(debts.id, id)) });
}

export async function getDebtPayments(userId: UserId, debtId: string) {
  return db.query.transactions.findMany({
    where: and(eq(transactions.userId, userId), eq(transactions.debtId, debtId)),
    with: { account: true, transferAccount: true, category: true },
    orderBy: (t, { desc }) => [desc(t.occurredAt), desc(t.createdAt)],
    limit: 200,
  });
}
