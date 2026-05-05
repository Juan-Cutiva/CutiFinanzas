import 'server-only';
import { and, eq, lte, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { accounts, transactions } from '@/db/schema';
import type { UserId } from '@/types/ids';

export interface CreditCardState {
  accountId: string;
  name: string;
  currency: string;
  creditLimitMinor: bigint | null;
  /** Saldo pendiente con el banco hoy (positivo = lo que debes). */
  realBalanceMinor: bigint;
  /** Cupo disponible hoy = creditLimit − saldo. null si no hay límite configurado. */
  availableMinor: bigint | null;
  totalChargedMinor: bigint;
  totalPaidMinor: bigint;
}

/**
 * Estado de una tarjeta de crédito hoy:
 * saldo = SUM(cc_charge) − SUM(cc_payment) (sobre la cuenta CC como destino).
 */
export async function getCreditCardState(
  userId: UserId,
  ccAccountId: string,
  today: string,
): Promise<CreditCardState | null> {
  const acc = await db.query.accounts.findFirst({
    where: and(eq(accounts.id, ccAccountId), eq(accounts.userId, userId)),
  });
  if (!acc || acc.type !== 'credit_card') return null;

  const charged = await db
    .select({
      sum: sql<string | null>`COALESCE(SUM(${transactions.amountMinor}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.accountId, ccAccountId),
        eq(transactions.kind, 'cc_charge'),
        eq(transactions.isPaid, true),
        lte(transactions.transactionDate, today),
      ),
    );
  const paid = await db
    .select({
      sum: sql<string | null>`COALESCE(SUM(${transactions.amountMinor}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.counterAccountId, ccAccountId),
        eq(transactions.kind, 'cc_payment'),
        eq(transactions.isPaid, true),
        lte(transactions.transactionDate, today),
      ),
    );

  const totalChargedMinor = BigInt(charged[0]?.sum ?? 0);
  const totalPaidMinor = BigInt(paid[0]?.sum ?? 0);
  const initial = BigInt(acc.initialBalanceMinor as unknown as string | number | bigint);
  const realBalanceMinor = initial + totalChargedMinor - totalPaidMinor;
  const limit = acc.creditLimitMinor as bigint | null;
  const availableMinor = limit === null ? null : limit - realBalanceMinor;

  return {
    accountId: acc.id,
    name: acc.name,
    currency: acc.currency,
    creditLimitMinor: limit,
    realBalanceMinor,
    availableMinor,
    totalChargedMinor,
    totalPaidMinor,
  };
}
