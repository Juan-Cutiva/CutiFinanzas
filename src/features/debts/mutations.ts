import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { debts } from '@/db/schema';
import { NotFoundError } from '@/lib/errors';
import type { CurrencyCode } from '@/lib/money';
import type { UserId } from '@/types/ids';
import { amountMajorToMinor } from '../transactions/domain';
import type { DebtInput, UpdateDebtInput } from './schema';

export async function createDebt(userId: UserId, input: DebtInput) {
  const currency = input.currency as CurrencyCode;
  const initialMinor = amountMajorToMinor(input.initialAmount, currency);
  const currentMinor = amountMajorToMinor(input.currentBalance, currency);
  const monthlyMinor = amountMajorToMinor(input.monthlyPayment, currency);

  const [row] = await db
    .insert(debts)
    .values({
      userId,
      accountId: input.accountId ?? null,
      name: input.name,
      initialAmountMinor: initialMinor,
      currentBalanceMinor: currentMinor,
      currency,
      interestRateAnnual:
        input.interestRateAnnual !== undefined ? String(input.interestRateAnnual) : null,
      monthlyPaymentMinor: monthlyMinor,
      startDate: input.startDate,
      endDate: input.endDate ?? null,
      totalInstallments: input.totalInstallments ?? null,
      paidInstallments: input.paidInstallments,
      notes: input.notes ?? null,
    })
    .returning();
  if (!row) throw new Error('No se pudo crear la deuda');
  return row;
}

export async function updateDebt(userId: UserId, input: UpdateDebtInput) {
  const { id, ...rest } = input;
  const existing = await db.query.debts.findFirst({
    where: and(eq(debts.userId, userId), eq(debts.id, id)),
  });
  if (!existing) throw new NotFoundError('Deuda');

  const currency = (rest.currency ?? existing.currency) as CurrencyCode;
  const patch: Record<string, unknown> = { updatedAt: sql`now()` };
  if (rest.name !== undefined) patch.name = rest.name;
  if (rest.initialAmount !== undefined)
    patch.initialAmountMinor = amountMajorToMinor(rest.initialAmount, currency);
  if (rest.currentBalance !== undefined)
    patch.currentBalanceMinor = amountMajorToMinor(rest.currentBalance, currency);
  if (rest.monthlyPayment !== undefined)
    patch.monthlyPaymentMinor = amountMajorToMinor(rest.monthlyPayment, currency);
  if (rest.interestRateAnnual !== undefined)
    patch.interestRateAnnual = String(rest.interestRateAnnual);
  if (rest.startDate) patch.startDate = rest.startDate;
  if (rest.endDate) patch.endDate = rest.endDate;
  if (rest.totalInstallments !== undefined) patch.totalInstallments = rest.totalInstallments;
  if (rest.paidInstallments !== undefined) patch.paidInstallments = rest.paidInstallments;
  if (rest.notes !== undefined) patch.notes = rest.notes;
  if (rest.accountId !== undefined) patch.accountId = rest.accountId;

  const [row] = await db
    .update(debts)
    .set(patch)
    .where(and(eq(debts.userId, userId), eq(debts.id, id)))
    .returning();
  if (!row) throw new NotFoundError('Deuda');
  return row;
}

export async function deleteDebt(userId: UserId, id: string) {
  const [row] = await db
    .delete(debts)
    .where(and(eq(debts.userId, userId), eq(debts.id, id)))
    .returning();
  if (!row) throw new NotFoundError('Deuda');
  return row;
}
