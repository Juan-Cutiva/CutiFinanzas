import 'server-only';
import { and, asc, eq, isNull, or, sum } from 'drizzle-orm';
import { db } from '@/db/client';
import { accounts, transactions } from '@/db/schema';
import type { UserId } from '@/types/ids';
import { type AccountType, balanceDeltaFor, classifyAccount } from './domain';

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

  const sumsAsAccount = await db
    .select({
      accountId: transactions.accountId,
      kind: transactions.kind,
      total: sum(transactions.amountMinor).mapWith(Number),
    })
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .groupBy(transactions.accountId, transactions.kind);

  const sumsAsTransfer = await db
    .select({
      accountId: transactions.transferAccountId,
      kind: transactions.kind,
      total: sum(transactions.amountMinor).mapWith(Number),
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        or(eq(transactions.kind, 'transfer'), eq(transactions.kind, 'credit_card_payment')),
      ),
    )
    .groupBy(transactions.transferAccountId, transactions.kind);

  return list.map((acc) => {
    let balanceMinor = BigInt(acc.initialBalanceMinor);
    const accountSums = sumsAsAccount.filter((s) => s.accountId === acc.id);
    const destinationSums = sumsAsTransfer.filter((s) => s.accountId === acc.id);

    for (const s of accountSums) {
      const amount = BigInt(s.total ?? 0);
      balanceMinor += balanceDeltaFor(acc.type as AccountType, s.kind, true, amount);
    }
    for (const s of destinationSums) {
      const amount = BigInt(s.total ?? 0);
      balanceMinor += balanceDeltaFor(acc.type as AccountType, s.kind, false, amount);
    }

    return {
      ...acc,
      balanceMinor,
      classification: classifyAccount(acc.type as AccountType),
    };
  });
}

export async function getAccountTransactions(userId: UserId, accountId: string) {
  return db.query.transactions.findMany({
    where: and(
      eq(transactions.userId, userId),
      or(eq(transactions.accountId, accountId), eq(transactions.transferAccountId, accountId)),
    ),
    with: { account: true, transferAccount: true, category: true },
    orderBy: (t, { desc }) => [desc(t.occurredAt), desc(t.createdAt)],
    limit: 200,
  });
}

export async function computeAccountBalance(userId: UserId, accountId: string): Promise<bigint> {
  const account = await getAccountById(userId, accountId);
  if (!account) return 0n;

  const sumsAsAccount = await db
    .select({
      kind: transactions.kind,
      total: sum(transactions.amountMinor).mapWith(Number),
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.accountId, accountId)))
    .groupBy(transactions.kind);

  const sumsAsTransfer = await db
    .select({
      kind: transactions.kind,
      total: sum(transactions.amountMinor).mapWith(Number),
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.transferAccountId, accountId),
        or(eq(transactions.kind, 'transfer'), eq(transactions.kind, 'credit_card_payment')),
      ),
    )
    .groupBy(transactions.kind);

  let balance = BigInt(account.initialBalanceMinor);
  for (const s of sumsAsAccount) {
    balance += balanceDeltaFor(account.type as AccountType, s.kind, true, BigInt(s.total ?? 0));
  }
  for (const s of sumsAsTransfer) {
    balance += balanceDeltaFor(account.type as AccountType, s.kind, false, BigInt(s.total ?? 0));
  }
  return balance;
}
