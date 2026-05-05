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
  UpdateTransactionFullInput,
  UpdateTransactionInput,
} from './schema';

type RuleRow = typeof recurringRules.$inferSelect;

/**
 * Ajusta el saldo y cuotas pagadas de una deuda. deltaMinor positivo
 * AUMENTA la deuda; negativo la reduce. installmentDelta es +1 cuando
 * se paga una cuota, -1 cuando se revierte un pago.
 */
async function adjustDebtBalance(
  userId: UserId,
  debtId: string,
  deltaMinor: bigint,
  installmentDelta = 0,
) {
  await db
    .update(debts)
    .set({
      currentBalanceMinor: sql`GREATEST(0::bigint, ${debts.currentBalanceMinor} + ${deltaMinor.toString()}::bigint)`,
      paidInstallments: sql`GREATEST(0, ${debts.paidInstallments} + ${installmentDelta})`,
      updatedAt: sql`now()`,
    })
    .where(and(eq(debts.userId, userId), eq(debts.id, debtId)));
}

/** Ajusta el acumulado de una meta de ahorro. deltaMinor positivo aporta. */
async function adjustSavingsGoal(userId: UserId, goalId: string, deltaMinor: bigint) {
  await db
    .update(savingsGoals)
    .set({
      currentAmountMinor: sql`GREATEST(0::bigint, ${savingsGoals.currentAmountMinor} + ${deltaMinor.toString()}::bigint)`,
      updatedAt: sql`now()`,
    })
    .where(and(eq(savingsGoals.userId, userId), eq(savingsGoals.id, goalId)));
}

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
    await adjustDebtBalance(userId, input.debtId, -amountMinor, 1);
  }

  if (input.kind === 'savings_contribution' && input.savingsGoalId) {
    await adjustSavingsGoal(userId, input.savingsGoalId, amountMinor);
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
  let newAmount: bigint | undefined;
  if (amount !== undefined) {
    newAmount = amountMajorToMinor(amount, existing.currency as CurrencyCode);
    patch.amountMinor = newAmount;
  }
  const [row] = await db
    .update(transactions)
    .set(patch)
    .where(and(eq(transactions.userId, userId), eq(transactions.id, id)))
    .returning();
  if (!row) throw new NotFoundError('Transacción');

  if (newAmount !== undefined) {
    const oldAmount = BigInt(existing.amountMinor);
    const delta = newAmount - oldAmount;
    if (delta !== 0n) {
      if (existing.kind === 'debt_payment' && existing.debtId) {
        await adjustDebtBalance(userId, existing.debtId, -delta);
      }
      if (existing.kind === 'savings_contribution' && existing.savingsGoalId) {
        await adjustSavingsGoal(userId, existing.savingsGoalId, delta);
      }
    }
  }
  return row;
}

interface OccurrenceValues {
  amountMinor: bigint;
  description?: string;
  categoryId?: string | null;
  notes?: string | null;
  receiptUrl?: string | null;
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
    const oldAmount = BigInt(existing.amountMinor);
    const newAmount = values.amountMinor;
    const delta = newAmount - oldAmount;

    const patch: Record<string, unknown> = {
      amountMinor: newAmount,
      updatedAt: sql`now()`,
    };
    if (values.description !== undefined) {
      patch.description = values.description.trim() || null;
    }
    if (values.categoryId !== undefined) patch.categoryId = values.categoryId;
    if (values.notes !== undefined) patch.notes = values.notes;
    if (values.receiptUrl !== undefined) patch.receiptUrl = values.receiptUrl;
    const [row] = await db
      .update(transactions)
      .set(patch)
      .where(and(eq(transactions.userId, userId), eq(transactions.id, existing.id)))
      .returning();

    if (delta !== 0n) {
      if (rule.kind === 'debt_payment' && rule.debtId) {
        await adjustDebtBalance(userId, rule.debtId, -delta);
      }
      if (rule.kind === 'savings_contribution' && rule.savingsGoalId) {
        await adjustSavingsGoal(userId, rule.savingsGoalId, delta);
      }
    }
    return row;
  }

  const [row] = await db
    .insert(transactions)
    .values({
      userId,
      accountId: rule.accountId,
      transferAccountId: rule.transferAccountId ?? null,
      categoryId: values.categoryId ?? rule.categoryId,
      debtId: rule.debtId ?? null,
      savingsGoalId: rule.savingsGoalId ?? null,
      kind: rule.kind,
      amountMinor: values.amountMinor,
      currency: rule.currency,
      occurredAt,
      description: (values.description?.trim() || null) ?? rule.name,
      notes: values.notes ?? rule.notes,
      receiptUrl: values.receiptUrl ?? null,
      isPaid: true,
      quincena: getQuincenaFromIsoDate(occurredAt),
      isRecurring: true,
      recurringRuleId: rule.id,
    })
    .returning();

  if (rule.kind === 'debt_payment' && rule.debtId) {
    await adjustDebtBalance(userId, rule.debtId, -values.amountMinor, 1);
  }
  if (rule.kind === 'savings_contribution' && rule.savingsGoalId) {
    await adjustSavingsGoal(userId, rule.savingsGoalId, values.amountMinor);
  }

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
        transferAccountId: rule.transferAccountId ?? null,
        categoryId: rule.categoryId,
        debtId: rule.debtId ?? null,
        savingsGoalId: rule.savingsGoalId ?? null,
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
      if (rule.kind === 'debt_payment' && rule.debtId) {
        await adjustDebtBalance(userId, rule.debtId, -(rule.amountMinor as bigint), 1);
      }
      if (rule.kind === 'savings_contribution' && rule.savingsGoalId) {
        await adjustSavingsGoal(userId, rule.savingsGoalId, rule.amountMinor as bigint);
      }
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
    // El comprobante solo aplica para "solo este mes". En "forward" la regla
    // se reusa para meses futuros donde aún no existe comprobante.
    receiptUrl: input.mode === 'this_month' ? input.receiptUrl : undefined,
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
 * Edición completa de una transacción puntual (no recurrente).
 * Permite cambiar: monto, fecha, cuenta origen y destino, kind dentro del
 * mismo "primary" (income↔income_fixed, expense↔expense_fixed),
 * categoría, deuda asignada, meta, descripción, notas y comprobante.
 *
 * Maneja correctamente las cascadas:
 * - Revertir/aplicar deltas a deudas y metas si cambian id o monto.
 * - Crear regla recurrente al pasar de variable a fija.
 * - Desactivar regla al pasar de fija a variable.
 * - El cambio entre primary kinds (gasto↔ingreso, etc.) NO se permite
 *   por el riesgo de inconsistencias; el usuario debe borrar y recrear.
 */
function primaryOf(kind: string): string {
  if (kind === 'income_fixed' || kind === 'income_variable') return 'income';
  if (kind === 'expense_fixed' || kind === 'expense_variable') return 'expense';
  return kind;
}

function isFixedKind(kind: string): boolean {
  return kind === 'income_fixed' || kind === 'expense_fixed';
}

export async function updateTransactionFull(userId: UserId, input: UpdateTransactionFullInput) {
  const existing = await db.query.transactions.findFirst({
    where: and(eq(transactions.userId, userId), eq(transactions.id, input.id)),
  });
  if (!existing) throw new NotFoundError('Transacción');

  if (primaryOf(existing.kind) !== primaryOf(input.kind)) {
    throw new ValidationError(
      'No se puede cambiar el tipo principal de un movimiento. Bórralo y crea uno nuevo.',
    );
  }

  // Validate the destination account belongs to the user when present.
  if (input.transferAccountId) {
    const dest = await db.query.accounts.findFirst({
      where: and(eq(accounts.userId, userId), eq(accounts.id, input.transferAccountId)),
    });
    if (!dest) throw new ValidationError('Cuenta destino inválida');
  }

  const account = await db.query.accounts.findFirst({
    where: and(eq(accounts.userId, userId), eq(accounts.id, input.accountId)),
  });
  if (!account) throw new ValidationError('Cuenta inválida');

  const currency = existing.currency as CurrencyCode;
  const newAmount = amountMajorToMinor(input.amount, currency);
  const oldAmount = BigInt(existing.amountMinor);

  // 1) Revertir impactos viejos en deudas y metas.
  if (existing.kind === 'debt_payment' && existing.debtId) {
    await adjustDebtBalance(userId, existing.debtId, oldAmount, -1);
  }
  if (existing.kind === 'savings_contribution' && existing.savingsGoalId) {
    await adjustSavingsGoal(userId, existing.savingsGoalId, -oldAmount);
  }

  // 2) Manejar regla recurrente.
  const wasFixed = isFixedKind(existing.kind) && existing.recurringRuleId;
  const willBeFixed = isFixedKind(input.kind);
  let recurringRuleId: string | null = existing.recurringRuleId ?? null;

  if (wasFixed && !willBeFixed) {
    // Pasó de fijo a variable: desactivar la regla.
    await db
      .update(recurringRules)
      .set({ isActive: false, updatedAt: sql`now()` })
      .where(
        and(
          eq(recurringRules.userId, userId),
          eq(recurringRules.id, existing.recurringRuleId as string),
        ),
      );
    recurringRuleId = null;
  } else if (!wasFixed && willBeFixed) {
    // Pasó de variable a fijo: crear regla nueva.
    const dayOfMonth = Number.parseInt(input.occurredAt.slice(8, 10), 10);
    const nextMonth = dayjs(input.occurredAt).add(1, 'month');
    const lastDayNext = nextMonth.endOf('month').date();
    const safeDayNext = Math.min(dayOfMonth, lastDayNext);
    const nextOccurrence = nextMonth.date(safeDayNext).format('YYYY-MM-DD');
    const ruleName =
      input.description?.trim() || (input.kind === 'income_fixed' ? 'Ingreso fijo' : 'Gasto fijo');

    const [rule] = await db
      .insert(recurringRules)
      .values({
        userId,
        accountId: input.accountId,
        transferAccountId: input.transferAccountId ?? null,
        categoryId: input.categoryId ?? null,
        debtId: null,
        savingsGoalId: null,
        kind: input.kind,
        name: ruleName,
        amountMinor: newAmount,
        currency,
        frequency: 'monthly',
        dayOfMonth,
        startDate: input.occurredAt,
        nextOccurrenceDate: nextOccurrence,
        isActive: true,
        notes: input.notes ?? null,
      })
      .returning();
    recurringRuleId = rule?.id ?? null;
  } else if (wasFixed && willBeFixed) {
    // Sigue fijo: actualizar la regla con los nuevos valores.
    await db
      .update(recurringRules)
      .set({
        accountId: input.accountId,
        transferAccountId: input.transferAccountId ?? null,
        categoryId: input.categoryId ?? null,
        kind: input.kind,
        amountMinor: newAmount,
        name: input.description?.trim() || existing.description || 'Movimiento recurrente',
        notes: input.notes ?? null,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(recurringRules.userId, userId),
          eq(recurringRules.id, existing.recurringRuleId as string),
        ),
      );
  }

  // 3) Actualizar la transacción.
  const [row] = await db
    .update(transactions)
    .set({
      accountId: input.accountId,
      transferAccountId: input.transferAccountId ?? null,
      categoryId: input.categoryId ?? null,
      debtId: input.kind === 'debt_payment' ? (input.debtId ?? null) : null,
      savingsGoalId: input.kind === 'savings_contribution' ? (input.savingsGoalId ?? null) : null,
      kind: input.kind,
      amountMinor: newAmount,
      occurredAt: input.occurredAt,
      description: input.description?.trim() || null,
      notes: input.notes ?? null,
      receiptUrl: input.receiptUrl ?? null,
      isRecurring: !!recurringRuleId,
      recurringRuleId,
      quincena: getQuincenaFromIsoDate(input.occurredAt),
      updatedAt: sql`now()`,
    })
    .where(and(eq(transactions.userId, userId), eq(transactions.id, input.id)))
    .returning();
  if (!row) throw new NotFoundError('Transacción');

  // 4) Aplicar nuevos impactos en deudas / metas.
  if (input.kind === 'debt_payment' && input.debtId) {
    await adjustDebtBalance(userId, input.debtId, -newAmount, 1);
  }
  if (input.kind === 'savings_contribution' && input.savingsGoalId) {
    await adjustSavingsGoal(userId, input.savingsGoalId, newAmount);
  }

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

    if (rule.kind === 'debt_payment' && rule.debtId) {
      await adjustDebtBalance(userId, rule.debtId, -(rule.amountMinor as bigint), 1);
    }
    if (rule.kind === 'savings_contribution' && rule.savingsGoalId) {
      await adjustSavingsGoal(userId, rule.savingsGoalId, rule.amountMinor as bigint);
    }
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

  if (row.kind === 'debt_payment' && row.debtId) {
    await adjustDebtBalance(userId, row.debtId, BigInt(row.amountMinor), -1);
  }
  if (row.kind === 'savings_contribution' && row.savingsGoalId) {
    await adjustSavingsGoal(userId, row.savingsGoalId, -BigInt(row.amountMinor));
  }
  return row;
}

/**
 * Borrado con scope para movimientos recurrentes.
 * - this_month: borra (o no inserta nada si era virtual) sólo esa ocurrencia.
 * - forward: borra la ocurrencia + las futuras + desactiva la regla.
 */
export async function deleteRecurringTransaction(
  userId: UserId,
  input: { id: string; mode: 'this_month' | 'forward' },
) {
  let ruleId: string;
  let occurredAt: string;
  let isVirtual = false;

  if (input.id.startsWith('virtual:')) {
    isVirtual = true;
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

  if (input.mode === 'this_month') {
    if (isVirtual) {
      // Virtual: no existe físicamente; insertar marcador con monto 0 evita
      // que la virtualización siga generando este mes.
      await db.insert(transactions).values({
        userId,
        accountId: rule.accountId,
        transferAccountId: rule.transferAccountId ?? null,
        categoryId: rule.categoryId,
        debtId: rule.debtId ?? null,
        savingsGoalId: rule.savingsGoalId ?? null,
        kind: rule.kind,
        amountMinor: 0n,
        currency: rule.currency,
        occurredAt,
        description: `${rule.name} (omitido)`,
        notes: 'Ocurrencia omitida desde el editor',
        isPaid: true,
        isRecurring: true,
        recurringRuleId: rule.id,
        quincena: getQuincenaFromIsoDate(occurredAt),
      });
      return { ok: true };
    }

    const [row] = await db
      .delete(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.recurringRuleId, ruleId),
          eq(transactions.occurredAt, occurredAt),
        ),
      )
      .returning();
    if (row) {
      if (row.kind === 'debt_payment' && row.debtId) {
        await adjustDebtBalance(userId, row.debtId, BigInt(row.amountMinor), -1);
      }
      if (row.kind === 'savings_contribution' && row.savingsGoalId) {
        await adjustSavingsGoal(userId, row.savingsGoalId, -BigInt(row.amountMinor));
      }
    }
    return { ok: true };
  }

  // forward: borrar la ocurrencia + futuras reales + desactivar regla.
  const futureRows = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.recurringRuleId, ruleId),
        sql`${transactions.occurredAt} >= ${occurredAt}`,
      ),
    );

  for (const r of futureRows) {
    if (r.kind === 'debt_payment' && r.debtId) {
      await adjustDebtBalance(userId, r.debtId, BigInt(r.amountMinor), -1);
    }
    if (r.kind === 'savings_contribution' && r.savingsGoalId) {
      await adjustSavingsGoal(userId, r.savingsGoalId, -BigInt(r.amountMinor));
    }
  }

  await db
    .delete(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.recurringRuleId, ruleId),
        sql`${transactions.occurredAt} >= ${occurredAt}`,
      ),
    );

  // Cierra la regla un día antes de la ocurrencia que se está borrando.
  const endDate = dayjs(occurredAt).subtract(1, 'day').format('YYYY-MM-DD');
  await db
    .update(recurringRules)
    .set({ isActive: false, endDate, updatedAt: sql`now()` })
    .where(and(eq(recurringRules.userId, userId), eq(recurringRules.id, ruleId)));

  return { ok: true };
}
