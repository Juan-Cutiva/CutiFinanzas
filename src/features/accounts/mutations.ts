import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { accounts } from '@/db/schema';
import { NotFoundError } from '@/lib/errors';
import { type CurrencyCode, moneyFromMajor, moneyToMinor } from '@/lib/money';
import type { UserId } from '@/types/ids';
import type { AccountInput, UpdateAccountInput } from './schema';

export async function createAccount(userId: UserId, input: AccountInput) {
  const currency = input.currency as CurrencyCode;
  const initialMinor = BigInt(moneyToMinor(moneyFromMajor(input.initialBalance ?? 0, currency)));
  const creditMinor =
    input.creditLimit !== undefined
      ? BigInt(moneyToMinor(moneyFromMajor(input.creditLimit, currency)))
      : null;

  const [row] = await db
    .insert(accounts)
    .values({
      userId,
      name: input.name,
      type: input.type,
      currency,
      initialBalanceMinor: initialMinor,
      creditLimitMinor: creditMinor,
      statementDay: input.statementDay ?? null,
      paymentDueDay: input.paymentDueDay ?? null,
      institution: input.institution ?? null,
      icon: input.icon,
      color: input.color,
    })
    .returning();
  if (!row) throw new Error('No se pudo crear la cuenta');
  return row;
}

export async function updateAccount(userId: UserId, input: UpdateAccountInput) {
  const { id, ...patch } = input;
  const [row] = await db
    .update(accounts)
    .set({ ...patch, updatedAt: sql`now()` })
    .where(and(eq(accounts.userId, userId), eq(accounts.id, id)))
    .returning();
  if (!row) throw new NotFoundError('Cuenta');
  return row;
}

export async function archiveAccount(userId: UserId, id: string) {
  const [row] = await db
    .update(accounts)
    .set({ archivedAt: sql`now()`, updatedAt: sql`now()` })
    .where(and(eq(accounts.userId, userId), eq(accounts.id, id)))
    .returning();
  if (!row) throw new NotFoundError('Cuenta');
  return row;
}
