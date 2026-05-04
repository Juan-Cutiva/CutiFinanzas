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
import type {
  TogglePaidInput,
  TransactionInput,
  UpdateRecurringTransactionInput,
  UpdateTransactionInput,
} from './schema';

type RuleRow = typeof recurringRules.$inferSelect;

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

  const shouldCreateRule =
    input.isRecurring || input.kind === 'income_fixed' || input.kind === 'expense_fixed';

  if (shouldCreateRule) {
    const dayOfMonth = Number.parseInt(input.occurredAt.slice(8, 10), 10);
    const nextMonth = dayjs(input.occurredAt).add(1, 'month');
    const lastDayNext = nextMonth.endOf('month').date();
    const safeDayNext = Math.min(dayOfMonth, lastDayNext);
    const nextOccurrence = nextMonth.date(safeDayNext).format('YYYY-MM-DD');

    const ruleName =
      input.description?.trim() ||
      (input.kind === 'income_fixed' || input.kind === 'income_variable'
        ? 'Ingreso'
        : input.kind === 'expense_fixed' || input.kind === 'expense_variable'
          ? 'Gasto'
          : input.kind === 'debt_payment'
            ? 'Pago de deuda'
            : input.kind === 'credit_card_payment'
              ? 'Pago de tarjeta'
              : input.kind === 'savings_contribution'
                ? 'Aporte de ahorro'
                : 'Movimiento recurrente');

    const [rule] = await db
      .insert(recurringRules)
      .values({
        userId,
        accountId: input.accountId,
        transferAccountId: input.transferAccountId ?? null,
        categoryId: input.categoryId ?? null,
        debtId: input.kind === 'debt_payment' ? (input.debtId ?? null) : null,
        savingsGoalId: input.kind === 'savings_contribution' ? (input.savingsGoalId ?? null) : null,
        kind: input.kind,
        name: ruleName,
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
  const { id, amount, ...rest } = input;
  const existing = await db.query.transactions.findFirst({
    where: and(eq(transactions.userId, userId), eq(transactions.id, id)),
  });
  if (!existing) throw new NotFoundError('Transacción');

  const patch: Record<string, unknown> = { ...rest, updatedAt: sql`now()` };
  if (amount !== undefined) {
    patch.amountMinor = amountMajorToMinor(amount, existing.currency as CurrencyCode);
  }
  const [row] = await db
    .update(transactions)
    .set(patch)
    .where(and(eq(transactions.userId, userId), eq(transactions.id, id)))
    .returning();
  if (!row) throw new NotFoundError('Transacción');
  return row;
}

interface OccurrenceValues {
  amountMinor: bigint;
  description?: string;
  categoryId?: string | null;
  notes?: string | null;
}

async function upsertOccurrence(
  userId: UserId,
  rule: RuleRow,
  occurredAt: string,
  values: OccurrenceValues,
) {
  const existing = await db.query.transactions.findFirst({
    where: and(
      eq(transactions.userId, userId),
      eq(transactions.recurringRuleId, rule.id),
      eq(transactions.occurredAt, occurredAt),
    ),
  });

  if (existing) {
    const patch: Record<string, unknown> = {
      amountMinor: values.amountMinor,
      updatedAt: sql`now()`,
    };
    if (values.description !== undefined) {
      patch.description = values.description.trim() || null;
    }
    if (values.categoryId !== undefined) patch.categoryId = values.categoryId;
    if (values.notes !== undefined) patch.notes = values.notes;
    const [row] = await db
      .update(transactions)
      .set(patch)
      .where(and(eq(transactions.userId, userId), eq(transactions.id, existing.id)))
      .returning();
    return row;
  }

  const [row] = await db
    .insert(transactions)
    .values({
      userId,
      accountId: rule.accountId,
      categoryId: values.categoryId ?? rule.categoryId,
      kind: rule.kind,
      amountMinor: values.amountMinor,
      currency: rule.currency,
      occurredAt,
      description: (values.description?.trim() || null) ?? rule.name,
      notes: values.notes ?? rule.notes,
      isPaid: true,
      quincena: getQuincenaFromIsoDate(occurredAt),
      isRecurring: true,
      recurringRuleId: rule.id,
    })
    .returning();
  return row;
}

async function materializePastOccurrences(userId: UserId, rule: RuleRow, beforeIso: string) {
  if (rule.frequency !== 'monthly') return;

  const realRows = await db.query.transactions.findMany({
    where: and(eq(transactions.userId, userId), eq(transactions.recurringRuleId, rule.id)),
    columns: { occurredAt: true },
  });
  const realDates = new Set(realRows.map((r) => r.occurredAt));

  const dayOfMonth = rule.dayOfMonth ?? Number.parseInt(rule.startDate.slice(8, 10), 10);
  const before = dayjs(beforeIso);
  let cursor = dayjs(rule.startDate).startOf('month');
  let safety = 366;

  while (cursor.isBefore(before, 'month') || cursor.isSame(before, 'month')) {
    if (safety-- <= 0) break;
    if (cursor.isSame(before, 'month')) break;

    const lastDay = cursor.endOf('month').date();
    const day = Math.min(dayOfMonth, lastDay);
    const dateStr = cursor.date(day).format('YYYY-MM-DD');

    if (
      dateStr >= rule.startDate &&
      dateStr < beforeIso &&
      (!rule.endDate || dateStr <= rule.endDate) &&
      !realDates.has(dateStr)
    ) {
      await db.insert(transactions).values({
        userId,
        accountId: rule.accountId,
        categoryId: rule.categoryId,
        kind: rule.kind,
        amountMinor: rule.amountMinor,
        currency: rule.currency,
        occurredAt: dateStr,
        description: rule.name,
        notes: rule.notes,
        isPaid: true,
        quincena: getQuincenaFromIsoDate(dateStr),
        isRecurring: true,
        recurringRuleId: rule.id,
      });
    }

    cursor = cursor.add(1, 'month');
  }
}

export async function updateRecurringTransaction(
  userId: UserId,
  input: UpdateRecurringTransactionInput,
) {
  let ruleId: string;
  let occurredAt: string;

  if (input.id.startsWith('virtual:')) {
    const parts = input.id.split(':');
    if (parts.length < 3) throw new ValidationError('Identificador inválido');
    ruleId = parts[1] as string;
    occurredAt = parts.slice(2).join(':');
  } else {
    const tx = await db.query.transactions.findFirst({
      where: and(eq(transactions.userId, userId), eq(transactions.id, input.id)),
    });
    if (!tx) throw new NotFoundError('Transacción');
    if (!tx.recurringRuleId) {
      throw new ValidationError('Esta transacción no es recurrente');
    }
    ruleId = tx.recurringRuleId;
    occurredAt = tx.occurredAt;
  }

  const rule = await db.query.recurringRules.findFirst({
    where: and(eq(recurringRules.userId, userId), eq(recurringRules.id, ruleId)),
  });
  if (!rule) throw new NotFoundError('Regla recurrente');

  const newAmountMinor = amountMajorToMinor(input.amount, rule.currency as CurrencyCode);
  const values: OccurrenceValues = {
    amountMinor: newAmountMinor,
    description: input.description,
    categoryId: input.categoryId,
    notes: input.notes,
  };

  if (input.mode === 'this_month') {
    return upsertOccurrence(userId, rule, occurredAt, values);
  }

  await materializePastOccurrences(userId, rule, occurredAt);
  const row = await upsertOccurrence(userId, rule, occurredAt, values);

  const dayOfMonth = rule.dayOfMonth ?? Number.parseInt(rule.startDate.slice(8, 10), 10);
  const nextMonth = dayjs(occurredAt).add(1, 'month');
  const lastDayNext = nextMonth.endOf('month').date();
  const safeDayNext = Math.min(dayOfMonth, lastDayNext);
  const nextOccurrence = nextMonth.date(safeDayNext).format('YYYY-MM-DD');

  await db
    .update(recurringRules)
    .set({
      amountMinor: newAmountMinor,
      name: input.description?.trim() || rule.name,
      categoryId: input.categoryId !== undefined ? input.categoryId : rule.categoryId,
      notes: input.notes !== undefined ? input.notes : rule.notes,
      nextOccurrenceDate: nextOccurrence,
      updatedAt: sql`now()`,
    })
    .where(and(eq(recurringRules.userId, userId), eq(recurringRules.id, rule.id)));

  return row;
}

/**
 * Marca una transacción recurrente como confirmada/no-confirmada.
 * Si la ocurrencia es virtual, se materializa como fila real con el flag.
 * Es solo un indicador visual: no afecta saldos ni reportes.
 */
export async function togglePaid(userId: UserId, input: TogglePaidInput) {
  if (input.id.startsWith('virtual:')) {
    const parts = input.id.split(':');
    if (parts.length < 3) throw new ValidationError('Identificador inválido');
    const ruleId = parts[1] as string;
    const occurredAt = parts.slice(2).join(':');

    const rule = await db.query.recurringRules.findFirst({
      where: and(eq(recurringRules.userId, userId), eq(recurringRules.id, ruleId)),
    });
    if (!rule) throw new NotFoundError('Regla recurrente');

    const [row] = await db
      .insert(transactions)
      .values({
        userId,
        accountId: rule.accountId,
        transferAccountId: rule.transferAccountId ?? null,
        categoryId: rule.categoryId,
        debtId: rule.debtId ?? null,
        savingsGoalId: rule.savingsGoalId ?? null,
        kind: rule.kind,
        amountMinor: rule.amountMinor,
        currency: rule.currency,
        occurredAt,
        description: rule.name,
        notes: rule.notes,
        isPaid: input.isPaid,
        isRecurring: true,
        recurringRuleId: rule.id,
        quincena: getQuincenaFromIsoDate(occurredAt),
      })
      .returning();
    return row;
  }

  const [row] = await db
    .update(transactions)
    .set({ isPaid: input.isPaid, updatedAt: sql`now()` })
    .where(and(eq(transactions.userId, userId), eq(transactions.id, input.id)))
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
