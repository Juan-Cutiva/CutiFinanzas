import 'server-only';
import { and, asc, eq, isNull, sum } from 'drizzle-orm';
import { db } from '@/db/client';
import { accounts, transactions } from '@/db/schema';
import type { UserId } from '@/types/ids';

export async function listAccountsByUser(userId: UserId) {
  return db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), isNull(accounts.archivedAt)))
    .orderBy(asc(accounts.name));
}

export async function getAccountById(userId: UserId, id: string) {
  return db.query.accounts.findFirst({
    where: and(eq(accounts.userId, userId), eq(accounts.id, id)),
  });
}

export async function listAccountsWithBalance(userId: UserId) {
  const list = await listAccountsByUser(userId);
  if (list.length === 0) return [];

  const sums = await db
    .select({
      accountId: transactions.accountId,
      kind: transactions.kind,
      total: sum(transactions.amountMinor).mapWith(Number),
    })
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .groupBy(transactions.accountId, transactions.kind);

  return list.map((acc) => {
    const accSums = sums.filter((s) => s.accountId === acc.id);
    let balanceMinor = Number(acc.initialBalanceMinor);
    for (const s of accSums) {
      if (s.kind === 'income') balanceMinor += s.total ?? 0;
      else balanceMinor -= s.total ?? 0;
    }
    return { ...acc, balanceMinor: BigInt(balanceMinor) };
  });
}
