import 'server-only';
import dayjs from 'dayjs';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { accounts, debts, recurringRules, savingsGoals, transactions } from '@/db/schema';
import { isLiabilityType } from '@/features/accounts/domain';
import { computeAccountBalance } from '@/features/accounts/queries';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { formatAmount } from '@/lib/format';
import type { CurrencyCode } from '@/lib/money';
import type { UserId } from '@/types/ids';
import { amountMajorToMinor, getQuincenaFromIsoDate } from './domain';
import type { TransactionInput, UpdateTransactionInput } from './schema';

export async function createTransaction(userId: UserId, input: TransactionInput) {
  const account = await db.query.accounts.findFirst({
    where: and(eq(accounts.userId, userId), eq(accounts.id, input.accountId)),
  });
  if (!account) throw new ValidationError('Cuenta inválida');
  if (account.currency !== input.currency) {
    throw new ValidationError(
      `La cuenta usa ${account.currency}; conviértelo o elige otra cuenta.`,
    );
  }

  let destination: typeof account | undefined;
  if (input.transferAccountId) {
    destination = await db.query.accounts.findFirst({
      where: and(eq(accounts.userId, userId), eq(accounts.id, input.transferAccountId)),
    });
    if (!destination) throw new ValidationError('Cuenta destino inválida');
    if (destination.currency !== account.currency) {
      throw new ValidationError('Las dos cuentas deben usar la misma moneda. Convierte primero.');
    }
  }

  if (input.kind === 'credit_card_payment') {
    if (!destination) {
      throw new ValidationError('Selecciona la tarjeta a la que estás pagando');
    }
    if (isLiabilityType(account.type)) {
      throw new ValidationError(
        'La cuenta de origen del pago debe ser de débito, ahorros o efectivo, no una tarjeta.',
      );
    }
    if (destination.type !== 'credit_card') {
      throw new ValidationError('La cuenta destino debe ser una tarjeta de crédito');
    }
    const cardDebt = await computeAccountBalance(userId, destination.id);
    const paymentMinor = amountMajorToMinor(input.amount, input.currency as CurrencyCode);
    if (paymentMinor > cardDebt) {
      const debtMajor = Number(cardDebt > 0n ? cardDebt : 0n) / 100;
      throw new ValidationError(
        `El pago supera la deuda actual de la tarjeta (${formatAmount(debtMajor, input.currency as CurrencyCode)}).`,
      );
    }
  }

  if (input.kind === 'debt_payment' && input.debtId) {
    const debtRow = await db.query.debts.findFirst({
      where: and(eq(debts.userId, userId), eq(debts.id, input.debtId)),
    });
    if (!debtRow) throw new ValidationError('Deuda inválida');
    if (debtRow.currency !== input.currency) {
      throw new ValidationError(`La deuda usa ${debtRow.currency}; usa una cuenta en esa moneda.`);
    }
    const debtBalance = BigInt(debtRow.currentBalanceMinor);
    const paymentMinor = amountMajorToMinor(input.amount, input.currency as CurrencyCode);
    if (paymentMinor > debtBalance) {
      const remainingMajor = Number(debtBalance > 0n ? debtBalance : 0n) / 100;
      throw new ValidationError(
        `El pago supera el saldo restante de la deuda. Restan ${formatAmount(remainingMajor, input.currency as CurrencyCode)}.`,
      );
    }
  }

  const amountMinor = amountMajorToMinor(input.amount, input.currency as CurrencyCode);
  const quincena = getQuincenaFromIsoDate(input.occurredAt);

  const reducesAccount =
    input.kind === 'expense_fixed' ||
    input.kind === 'expense_variable' ||
    input.kind === 'transfer' ||
    input.kind === 'credit_card_payment' ||
    input.kind === 'debt_payment' ||
    input.kind === 'savings_contribution';

  if (reducesAccount) {
    const currentBalance = await computeAccountBalance(userId, input.accountId);
    const currency = account.currency as CurrencyCode;

    if (account.type === 'credit_card') {
      const limit = account.creditLimitMinor ? BigInt(account.creditLimitMinor) : null;
      if (limit !== null) {
        const newDebt = currentBalance + amountMinor;
        if (newDebt > limit) {
          const available = limit - currentBalance;
          const availableMajor = available > 0n ? Number(available) / 100 : 0;
          throw new ValidationError(
            `Excedes el cupo de la tarjeta. Disponible: ${formatAmount(availableMajor, currency)}.`,
          );
        }
      }
    } else {
      if (amountMinor > currentBalance) {
        const availableMajor = Number(currentBalance > 0n ? currentBalance : 0n) / 100;
        throw new ValidationError(
          `No tienes saldo suficiente en ${account.name}. Disponible: ${formatAmount(availableMajor, currency)}.`,
        );
      }
    }
  }

  let recurringRuleId: string | null = null;

  if (input.kind === 'income_fixed' || input.kind === 'expense_fixed') {
    const dayOfMonth = Number.parseInt(input.occurredAt.slice(8, 10), 10);
    const nextMonth = dayjs(input.occurredAt).add(1, 'month');
    const lastDayNext = nextMonth.endOf('month').date();
    const safeDayNext = Math.min(dayOfMonth, lastDayNext);
    const nextOccurrence = nextMonth.date(safeDayNext).format('YYYY-MM-DD');

    const [rule] = await db
      .insert(recurringRules)
      .values({
        userId,
        accountId: input.accountId,
        categoryId: input.categoryId ?? null,
        kind: input.kind,
        name:
          input.description?.trim() ||
          (input.kind === 'income_fixed' ? 'Ingreso fijo' : 'Gasto fijo'),
        amountMinor,
        currency: input.currency,
        frequency: 'monthly',
        dayOfMonth,
        startDate: input.occurredAt,
        nextOccurrenceDate: nextOccurrence,
        isActive: true,
        notes: input.notes ?? null,
      })
      .returning();
    recurringRuleId = rule?.id ?? null;
  }

  const [row] = await db
    .insert(transactions)
    .values({
      userId,
      accountId: input.accountId,
      transferAccountId: input.transferAccountId ?? null,
      categoryId: input.categoryId ?? null,
      debtId: input.kind === 'debt_payment' ? (input.debtId ?? null) : null,
      savingsGoalId: input.kind === 'savings_contribution' ? (input.savingsGoalId ?? null) : null,
      kind: input.kind,
      amountMinor,
      currency: input.currency,
      occurredAt: input.occurredAt,
      description: input.description ?? null,
      notes: input.notes ?? null,
      isPaid: input.isPaid,
      receiptUrl: input.receiptUrl ?? null,
      quincena,
      isRecurring: !!recurringRuleId,
      recurringRuleId,
    })
    .returning();
  if (!row) throw new Error('No se pudo registrar la transacción');

  if (input.kind === 'debt_payment' && input.debtId) {
    await db
      .update(debts)
      .set({
        currentBalanceMinor: sql`GREATEST(0::bigint, ${debts.currentBalanceMinor} - ${amountMinor.toString()}::bigint)`,
        paidInstallments: sql`${debts.paidInstallments} + 1`,
        updatedAt: sql`now()`,
      })
      .where(and(eq(debts.userId, userId), eq(debts.id, input.debtId)));
  }

  if (input.kind === 'savings_contribution' && input.savingsGoalId) {
    await db
      .update(savingsGoals)
      .set({
        currentAmountMinor: sql`${savingsGoals.currentAmountMinor} + ${amountMinor.toString()}::bigint`,
        updatedAt: sql`now()`,
      })
      .where(and(eq(savingsGoals.userId, userId), eq(savingsGoals.id, input.savingsGoalId)));
  }

  return row;
}

export async function updateTransaction(userId: UserId, input: UpdateTransactionInput) {
  const { id, ...patch } = input;
  const [row] = await db
    .update(transactions)
    .set({ ...patch, updatedAt: sql`now()` })
    .where(and(eq(transactions.userId, userId), eq(transactions.id, id)))
    .returning();
  if (!row) throw new NotFoundError('Transacción');
  return row;
}

export async function deleteTransaction(userId: UserId, id: string) {
  const [row] = await db
    .delete(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.id, id)))
    .returning();
  if (!row) throw new NotFoundError('Transacción');
  return row;
}
