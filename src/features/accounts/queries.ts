import 'server-only';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { cache } from 'react';
import { db } from '@/db/client';
import { accounts } from '@/db/schema';
import {
  type AccountWithBalance,
  getRealBalanceMinor,
  listAccountsWithBalances,
} from '@/lib/accounting';
import type { UserId } from '@/types/ids';

/**
 * Lista plana de cuentas (sin balances). Para UI que solo necesita nombre/tipo/currency.
 */
export const listAccountsByUser = cache(async function listAccountsByUser(userId: UserId) {
  return db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), isNull(accounts.archivedAt)))
    .orderBy(asc(accounts.name));
});

export const getAccountById = cache(async function getAccountById(userId: UserId, id: string) {
  return db.query.accounts.findFirst({
    where: and(eq(accounts.userId, userId), eq(accounts.id, id)),
  });
});

/**
 * Lista de cuentas con balances real y proyectado al día asOfDate.
 */
export async function listAccountsForDashboard(
  userId: UserId,
  asOfDate: string,
  today: string,
): Promise<AccountWithBalance[]> {
  return listAccountsWithBalances(userId, asOfDate, today);
}

export async function getAccountBalance(
  userId: UserId,
  accountId: string,
  asOfDate: string,
): Promise<bigint> {
  return getRealBalanceMinor(userId, accountId, asOfDate);
}
