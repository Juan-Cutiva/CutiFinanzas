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
      statementDay: input.type === 'credit_card' ? (input.statementDay ?? null) : null,
      paymentDueDay: input.type === 'credit_card' ? (input.paymentDueDay ?? null) : null,
      institution: input.institution ?? null,
      icon: input.icon,
      color: input.color,
    })
    .returning();
  if (!row) throw new Error('No se pudo crear la cuenta');
  return row;
}

export async function updateAccount(userId: UserId, input: UpdateAccountInput) {
  const existing = await db.query.accounts.findFirst({
    where: and(eq(accounts.userId, userId), eq(accounts.id, input.id)),
  });
  if (!existing) throw new NotFoundError('Cuenta');

  const currency = existing.currency as CurrencyCode;
  const patch: Record<string, unknown> = { updatedAt: sql`now()` };
  if (input.name !== undefined) patch.name = input.name;
  if (input.institution !== undefined) patch.institution = input.institution;
  if (input.icon !== undefined) patch.icon = input.icon;
  if (input.color !== undefined) patch.color = input.color;
  if (input.initialBalance !== undefined) {
    patch.initialBalanceMinor = BigInt(
      moneyToMinor(moneyFromMajor(input.initialBalance, currency)),
    );
  }
  if (input.creditLimit !== undefined) {
    patch.creditLimitMinor =
      input.creditLimit === null
        ? null
        : BigInt(moneyToMinor(moneyFromMajor(input.creditLimit, currency)));
  }
  if (input.statementDay !== undefined) patch.statementDay = input.statementDay;
  if (input.paymentDueDay !== undefined) patch.paymentDueDay = input.paymentDueDay;

  const [row] = await db
    .update(accounts)
    .set(patch)
    .where(and(eq(accounts.userId, userId), eq(accounts.id, input.id)))
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
