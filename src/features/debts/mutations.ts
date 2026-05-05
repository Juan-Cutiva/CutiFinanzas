import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { debtEvents, debts } from '@/db/schema';
import { NotFoundError } from '@/lib/errors';
import type { CurrencyCode } from '@/lib/money';
import type { UserId } from '@/types/ids';
import { amountMajorToMinor } from '../transactions/domain';
import type {
  DebtInput,
  RecordDebtUsageInput,
  UpdateDebtInput,
  UpdateDebtUsageInput,
} from './schema';

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

/**
 * Aumenta el saldo de una deuda y su monto inicial, sin afectar cuentas
 * ni aparecer en /gastos. Pensado para registrar un "uso" adicional
 * (compra extra a cuotas, mora capitalizada, refinanciación, etc.).
 * Crea un debt_event para el historial visible en /deudas/[id].
 */
export async function recordDebtUsage(userId: UserId, input: RecordDebtUsageInput) {
  const existing = await db.query.debts.findFirst({
    where: and(eq(debts.userId, userId), eq(debts.id, input.id)),
  });
  if (!existing) throw new NotFoundError('Deuda');

  const currency = existing.currency as CurrencyCode;
  const usageMinor = amountMajorToMinor(input.amount, currency);
  const today = new Date().toISOString().slice(0, 10);
  const occurredAt = input.occurredAt ?? today;

  await db.insert(debtEvents).values({
    userId,
    debtId: input.id,
    amountMinor: usageMinor,
    currency,
    description: input.description,
    occurredAt,
  });

  const [row] = await db
    .update(debts)
    .set({
      initialAmountMinor: sql`${debts.initialAmountMinor} + ${usageMinor.toString()}::bigint`,
      currentBalanceMinor: sql`${debts.currentBalanceMinor} + ${usageMinor.toString()}::bigint`,
      updatedAt: sql`now()`,
    })
    .where(and(eq(debts.userId, userId), eq(debts.id, input.id)))
    .returning();
  if (!row) throw new NotFoundError('Deuda');
  return row;
}

/**
 * Edita un debt_event existente. Calcula el delta entre el monto nuevo y
 * el viejo, y lo aplica al saldo y monto inicial de la deuda. Si la
 * descripción cambia, también la actualiza.
 */
export async function updateDebtUsage(userId: UserId, input: UpdateDebtUsageInput) {
  const existing = await db.query.debtEvents.findFirst({
    where: and(eq(debtEvents.userId, userId), eq(debtEvents.id, input.eventId)),
  });
  if (!existing) throw new NotFoundError('Aumento de saldo');

  const currency = existing.currency as CurrencyCode;
  const newAmountMinor = amountMajorToMinor(input.amount, currency);
  const oldAmountMinor = BigInt(existing.amountMinor);
  const delta = newAmountMinor - oldAmountMinor;

  await db
    .update(debtEvents)
    .set({ amountMinor: newAmountMinor, description: input.description })
    .where(and(eq(debtEvents.userId, userId), eq(debtEvents.id, input.eventId)));

  if (delta !== 0n) {
    await db
      .update(debts)
      .set({
        initialAmountMinor: sql`${debts.initialAmountMinor} + ${delta.toString()}::bigint`,
        currentBalanceMinor: sql`GREATEST(0::bigint, ${debts.currentBalanceMinor} + ${delta.toString()}::bigint)`,
        updatedAt: sql`now()`,
      })
      .where(and(eq(debts.userId, userId), eq(debts.id, existing.debtId)));
  }

  return { ok: true };
}

/** Borra un debt_event y revierte el bump correspondiente al saldo y al inicial. */
export async function deleteDebtUsage(userId: UserId, eventId: string) {
  const existing = await db.query.debtEvents.findFirst({
    where: and(eq(debtEvents.userId, userId), eq(debtEvents.id, eventId)),
  });
  if (!existing) throw new NotFoundError('Aumento de saldo');

  const amountMinor = BigInt(existing.amountMinor);

  await db.delete(debtEvents).where(and(eq(debtEvents.userId, userId), eq(debtEvents.id, eventId)));

  await db
    .update(debts)
    .set({
      initialAmountMinor: sql`${debts.initialAmountMinor} - ${amountMinor.toString()}::bigint`,
      currentBalanceMinor: sql`GREATEST(0::bigint, ${debts.currentBalanceMinor} - ${amountMinor.toString()}::bigint)`,
      updatedAt: sql`now()`,
    })
    .where(and(eq(debts.userId, userId), eq(debts.id, existing.debtId)));

  return { ok: true };
}

export async function deleteDebt(userId: UserId, id: string) {
  const [row] = await db
    .delete(debts)
    .where(and(eq(debts.userId, userId), eq(debts.id, id)))
    .returning();
  if (!row) throw new NotFoundError('Deuda');
  return row;
}
