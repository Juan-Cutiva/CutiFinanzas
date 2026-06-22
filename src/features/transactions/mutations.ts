import 'server-only';
import dayjs from 'dayjs';
import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { recurringRules, transactions } from '@/db/schema';
import type { TransactionKind } from '@/lib/accounting';
import {
  generateVirtualOccurrences,
  type RecurringRuleForVirtuals,
} from '@/lib/accounting/virtuals';
import { NotFoundError, ValidationError } from '@/lib/errors';
import type { CurrencyCode } from '@/lib/money';
import type { UserId } from '@/types/ids';
import { amountMajorToMinor, nextOccurrenceFor } from './domain';
import type {
  CreateTransactionInput,
  DeleteRecurringInput,
  DeleteVirtualInput,
  EditVirtualInput,
  TogglePaidInput,
  UpdateRecurringInput,
  UpdateTransactionInput,
} from './schema';

/**
 * Crea una transacción puntual o recurrente.
 *
 * Puntual: una fila en `transactions`.
 * Recurrente: una fila en `recurring_rules` + materialización inmediata de la primera
 * ocurrencia (la fecha indicada). El cron materializa las siguientes al pasar la fecha.
 */
export async function createTransaction(userId: UserId, input: CreateTransactionInput) {
  const currency = input.currency as CurrencyCode;
  const amountMinor = amountMajorToMinor(input.amount, currency);
  const baseValues = {
    userId,
    accountId: input.accountId ?? null,
    counterAccountId: input.counterAccountId ?? null,
    categoryId: input.categoryId ?? null,
    debtId: input.debtId ?? null,
    savingsGoalId: input.savingsGoalId ?? null,
    kind: input.kind,
    amountMinor,
    currency,
    transactionDate: input.transactionDate,
    description: input.description ?? null,
    notes: input.notes ?? null,
    receiptUrl: input.receiptUrl ?? null,
    isPaid: true as const,
  };

  if (!input.recurrence) {
    const [row] = await db.insert(transactions).values(baseValues).returning();
    if (!row) throw new Error('No se pudo crear la transacción');
    return row;
  }

  // Recurrente: rule + primera ocurrencia.
  const next = nextOccurrenceFor(
    input.transactionDate,
    input.recurrence.frequency,
    input.recurrence.dayOfMonth ?? null,
  );
  const [rule] = await db
    .insert(recurringRules)
    .values({
      userId,
      accountId: input.accountId,
      counterAccountId: input.counterAccountId ?? null,
      categoryId: input.categoryId ?? null,
      debtId: input.debtId ?? null,
      savingsGoalId: input.savingsGoalId ?? null,
      kind: input.kind,
      name: input.recurrence.name,
      amountMinor,
      currency,
      frequency: input.recurrence.frequency,
      dayOfMonth: input.recurrence.dayOfMonth ?? null,
      startDate: input.transactionDate,
      endDate: input.recurrence.endDate ?? null,
      nextOccurrenceDate: next,
      isActive: true,
    })
    .returning();
  if (!rule) throw new Error('No se pudo crear la regla recurrente');

  // La primera ocurrencia de una recurrente nace SIN confirmar (isPaid=false):
  // el usuario la marca cuando realmente paga/recibe. Las one-off (arriba) sí
  // quedan confirmadas. isPaid no afecta balances (solo marca visual).
  const [row] = await db
    .insert(transactions)
    .values({ ...baseValues, recurringRuleId: rule.id, isPaid: false })
    .onConflictDoNothing()
    .returning();
  return row ?? null;
}

/**
 * Edita una transacción puntual o una ocurrencia individual de recurrente.
 * No cambia el `kind`.
 */
export async function updateTransaction(userId: UserId, input: UpdateTransactionInput) {
  const existing = await db.query.transactions.findFirst({
    where: and(eq(transactions.id, input.id), eq(transactions.userId, userId)),
  });
  if (!existing) throw new NotFoundError('Transacción');

  const patch: Record<string, unknown> = { updatedAt: sql`now()` };
  if (input.amount !== undefined) {
    patch.amountMinor = amountMajorToMinor(input.amount, existing.currency as CurrencyCode);
  }
  if (input.transactionDate !== undefined) patch.transactionDate = input.transactionDate;
  if (input.accountId !== undefined) patch.accountId = input.accountId;
  if (input.counterAccountId !== undefined) patch.counterAccountId = input.counterAccountId;
  if (input.categoryId !== undefined) patch.categoryId = input.categoryId;
  if (input.debtId !== undefined) patch.debtId = input.debtId;
  if (input.savingsGoalId !== undefined) patch.savingsGoalId = input.savingsGoalId;
  if (input.description !== undefined) patch.description = input.description;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.receiptUrl !== undefined) patch.receiptUrl = input.receiptUrl;
  if (input.isPaid !== undefined) patch.isPaid = input.isPaid;

  const [row] = await db
    .update(transactions)
    .set(patch)
    .where(and(eq(transactions.id, input.id), eq(transactions.userId, userId)))
    .returning();
  if (!row) throw new NotFoundError('Transacción');
  return row;
}

/**
 * Edita una ocurrencia de regla recurrente con dos modos:
 *
 * 'this_one' — solo edita esa fila concreta (no afecta la regla ni otras ocurrencias).
 *
 * 'forward' — versionado iCal:
 *   1. Cierra la regla actual: endDate = transactionDate − 1 día, isActive=false.
 *   2. Crea una nueva regla con los nuevos valores y startDate = transactionDate,
 *      supersedesId = regla cerrada.
 *   3. Borra todas las transacciones materializadas de la regla vieja con fecha ≥ cutoff.
 *   4. Materializa la primera ocurrencia de la nueva regla en cutoffDate.
 */
export async function updateRecurring(userId: UserId, input: UpdateRecurringInput) {
  const tx = await db.query.transactions.findFirst({
    where: and(eq(transactions.id, input.transactionId), eq(transactions.userId, userId)),
  });
  if (!tx) throw new NotFoundError('Transacción');
  if (!tx.recurringRuleId) {
    throw new ValidationError('Esta transacción no es recurrente. Usa updateTransaction.');
  }

  if (input.mode === 'this_one') {
    return updateTransaction(userId, {
      id: input.transactionId,
      amount: input.amount,
      description: input.description ?? undefined,
      notes: input.notes ?? undefined,
      categoryId: input.categoryId ?? undefined,
      accountId: input.accountId,
      counterAccountId: input.counterAccountId ?? undefined,
      receiptUrl: input.receiptUrl ?? undefined,
    });
  }

  const oldRule = await db.query.recurringRules.findFirst({
    where: and(eq(recurringRules.id, tx.recurringRuleId), eq(recurringRules.userId, userId)),
  });
  if (!oldRule) throw new NotFoundError('Regla recurrente');

  const cutoffDate = tx.transactionDate;
  const dayBefore = dayjs(cutoffDate).subtract(1, 'day').format('YYYY-MM-DD');

  // Sin db.transaction: neon-http no soporta sesiones. Operamos secuencial.
  // Orden: materializar virtuales pendientes de la regla vieja en (nextOcc..dayBefore]
  // → borrar ocurrencias futuras de la regla vieja → crear nueva regla
  // → cerrar regla vieja → materializar primera ocurrencia de la nueva.
  // Si algo falla a media, la regla vieja sigue activa (estado consistente).

  // Edge case: el cron está atrasado (nextOccurrenceDate < cutoffDate). Las
  // ocurrencias entre nextOcc y dayBefore quedarían perdidas al cerrar la regla.
  // Materializamos esas pendientes con los valores VIEJOS antes de cerrar.
  if (oldRule.nextOccurrenceDate <= dayBefore) {
    const ruleVirt = ruleRowToVirtual(oldRule);
    const pending = generateVirtualOccurrences(ruleVirt, dayBefore);
    for (const v of pending) {
      await db
        .insert(transactions)
        .values({
          userId,
          accountId: oldRule.accountId,
          counterAccountId: oldRule.counterAccountId,
          categoryId: oldRule.categoryId,
          debtId: oldRule.debtId,
          savingsGoalId: oldRule.savingsGoalId,
          kind: oldRule.kind,
          amountMinor: oldRule.amountMinor,
          currency: oldRule.currency,
          transactionDate: v.transactionDate,
          description: oldRule.name,
          notes: oldRule.notes ?? null,
          recurringRuleId: oldRule.id,
          // Recurrente materializada → sin confirmar (checkbox vacío).
          isPaid: false,
        })
        // Sin `target` — el unique index es PARTIAL y PG rechaza
        // `ON CONFLICT (cols)` sin la WHERE clause correspondiente.
        .onConflictDoNothing();
    }
  }

  await db
    .delete(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.recurringRuleId, oldRule.id),
        gte(transactions.transactionDate, cutoffDate),
      ),
    );

  const newAmountMinor =
    input.amount !== undefined
      ? amountMajorToMinor(input.amount, oldRule.currency as CurrencyCode)
      : (oldRule.amountMinor as bigint);
  const next = nextOccurrenceFor(
    cutoffDate,
    oldRule.frequency as 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly',
    oldRule.dayOfMonth,
  );

  const [newRule] = await db
    .insert(recurringRules)
    .values({
      userId,
      accountId: input.accountId ?? oldRule.accountId,
      counterAccountId:
        input.counterAccountId !== undefined ? input.counterAccountId : oldRule.counterAccountId,
      categoryId: input.categoryId !== undefined ? input.categoryId : oldRule.categoryId,
      debtId: oldRule.debtId,
      savingsGoalId: oldRule.savingsGoalId,
      kind: oldRule.kind,
      name: oldRule.name,
      amountMinor: newAmountMinor,
      currency: oldRule.currency,
      frequency: oldRule.frequency,
      dayOfMonth: oldRule.dayOfMonth,
      dayOfWeek: oldRule.dayOfWeek,
      startDate: cutoffDate,
      endDate: oldRule.endDate,
      nextOccurrenceDate: next,
      isActive: true,
      supersedesId: oldRule.id,
    })
    .returning();
  if (!newRule) throw new Error('No se pudo crear la nueva versión');

  await db
    .update(recurringRules)
    // No seteamos isActive=false porque la regla puede tener ocurrencias
    // pendientes entre nextOccurrenceDate y dayBefore (si cutoff > next). Cron y
    // virtual generator respetan endDate automáticamente.
    .set({ endDate: dayBefore, updatedAt: sql`now()` })
    .where(eq(recurringRules.id, oldRule.id));

  const [row] = await db
    .insert(transactions)
    .values({
      userId,
      accountId: newRule.accountId,
      counterAccountId: newRule.counterAccountId,
      categoryId: newRule.categoryId,
      debtId: newRule.debtId,
      savingsGoalId: newRule.savingsGoalId,
      kind: newRule.kind,
      amountMinor: newRule.amountMinor,
      currency: newRule.currency,
      transactionDate: cutoffDate,
      description: input.description ?? oldRule.name,
      notes: input.notes ?? null,
      receiptUrl: input.receiptUrl ?? null,
      recurringRuleId: newRule.id,
      // Recurrente materializada → sin confirmar (checkbox vacío).
      isPaid: false,
    })
    .onConflictDoNothing()
    .returning();
  return row ?? null;
}

export async function togglePaid(userId: UserId, input: TogglePaidInput) {
  const [row] = await db
    .update(transactions)
    .set({ isPaid: input.isPaid, updatedAt: sql`now()` })
    .where(and(eq(transactions.id, input.id), eq(transactions.userId, userId)))
    .returning();
  if (!row) throw new NotFoundError('Transacción');
  return row;
}

export async function deleteTransaction(userId: UserId, id: string) {
  const [row] = await db
    .delete(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    .returning();
  if (!row) throw new NotFoundError('Transacción');
  return row;
}

/**
 * Borra una ocurrencia recurrente.
 *
 * 'this_one' — solo esa fila. La regla sigue activa.
 * 'forward' — cierra regla en cutoff y borra ocurrencias materializadas ≥ cutoff.
 */
export async function deleteRecurring(userId: UserId, input: DeleteRecurringInput) {
  const tx = await db.query.transactions.findFirst({
    where: and(eq(transactions.id, input.transactionId), eq(transactions.userId, userId)),
  });
  if (!tx) throw new NotFoundError('Transacción');

  if (input.mode === 'this_one' || !tx.recurringRuleId) {
    return deleteTransaction(userId, input.transactionId);
  }

  const ruleId = tx.recurringRuleId;
  const cutoff = tx.transactionDate;
  const dayBefore = dayjs(cutoff).subtract(1, 'day').format('YYYY-MM-DD');

  // Sin db.transaction porque neon-http no soporta sesiones; secuencial es OK
  // para uso personal. Cierra primero la regla, luego borra ocurrencias futuras.
  await db
    .update(recurringRules)
    // No seteamos isActive=false porque la regla puede tener ocurrencias
    // pendientes entre nextOccurrenceDate y dayBefore (si cutoff > next). Cron y
    // virtual generator respetan endDate automáticamente.
    .set({ endDate: dayBefore, updatedAt: sql`now()` })
    .where(eq(recurringRules.id, ruleId));
  await db
    .delete(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.recurringRuleId, ruleId),
        gte(transactions.transactionDate, cutoff),
      ),
    );
  return { ok: true } as const;
}

/**
 * Edita una ocurrencia VIRTUAL (futura, aún no materializada).
 *
 * mode='this_one': override puntual. Materializa la fila en la fecha con los
 *   valores nuevos (insert; si ya existe por algún motivo, se actualiza).
 *   El cron no la duplica por el unique index (rule_id, transaction_date).
 *   Las demás ocurrencias futuras siguen igual.
 *
 * mode='forward': cierra la regla actual con endDate = occurrenceDate − 1 día,
 *   crea una nueva regla con startDate = occurrenceDate y los valores nuevos
 *   (igual que updateRecurring forward). Las ocurrencias materializadas con
 *   fecha ≥ cutoff se borran (las futuras se generarán con la nueva regla).
 *   El pasado intacto.
 */
export async function editVirtualOccurrence(userId: UserId, input: EditVirtualInput) {
  const rule = await db.query.recurringRules.findFirst({
    where: and(eq(recurringRules.id, input.ruleId), eq(recurringRules.userId, userId)),
  });
  if (!rule) throw new NotFoundError('Regla recurrente');

  const currency = rule.currency as CurrencyCode;
  const newAmountMinor =
    input.amount !== undefined
      ? amountMajorToMinor(input.amount, currency)
      : (rule.amountMinor as bigint);

  if (input.mode === 'forward') {
    const cutoff = input.occurrenceDate;
    const dayBefore = dayjs(cutoff).subtract(1, 'day').format('YYYY-MM-DD');

    // Edge case: si el cron está atrasado (nextOccurrenceDate < cutoff), las
    // ocurrencias pendientes entre nextOcc y dayBefore se perderían al cerrar la
    // regla vieja. Materializa esas pendientes con los valores VIEJOS antes.
    if (rule.nextOccurrenceDate <= dayBefore) {
      const ruleVirt = ruleRowToVirtual(rule);
      const pending = generateVirtualOccurrences(ruleVirt, dayBefore);
      for (const v of pending) {
        await db
          .insert(transactions)
          .values({
            userId,
            accountId: rule.accountId,
            counterAccountId: rule.counterAccountId,
            categoryId: rule.categoryId,
            debtId: rule.debtId,
            savingsGoalId: rule.savingsGoalId,
            kind: rule.kind,
            amountMinor: rule.amountMinor,
            currency: rule.currency,
            transactionDate: v.transactionDate,
            description: rule.name,
            notes: rule.notes ?? null,
            recurringRuleId: rule.id,
            // Recurrente materializada → sin confirmar (checkbox vacío).
            isPaid: false,
          })
          // Sin `target` — el unique index es PARTIAL y PG rechaza
          // `ON CONFLICT (cols)` sin la WHERE clause correspondiente.
          .onConflictDoNothing();
      }
    }

    // Borra ocurrencias materializadas de la regla vieja con fecha ≥ cutoff.
    await db
      .delete(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.recurringRuleId, rule.id),
          gte(transactions.transactionDate, cutoff),
        ),
      );

    const next = nextOccurrenceFor(
      cutoff,
      rule.frequency as 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly',
      rule.dayOfMonth,
    );
    const [newRule] = await db
      .insert(recurringRules)
      .values({
        userId,
        accountId: input.accountId ?? rule.accountId,
        counterAccountId:
          input.counterAccountId !== undefined ? input.counterAccountId : rule.counterAccountId,
        categoryId: input.categoryId !== undefined ? input.categoryId : rule.categoryId,
        debtId: rule.debtId,
        savingsGoalId: rule.savingsGoalId,
        kind: rule.kind,
        name: rule.name,
        amountMinor: newAmountMinor,
        currency: rule.currency,
        frequency: rule.frequency,
        dayOfMonth: rule.dayOfMonth,
        dayOfWeek: rule.dayOfWeek,
        startDate: cutoff,
        endDate: rule.endDate,
        nextOccurrenceDate: next,
        isActive: true,
        supersedesId: rule.id,
      })
      .returning();
    if (!newRule) throw new Error('No se pudo crear la nueva versión');

    await db
      .update(recurringRules)
      // No seteamos isActive=false porque la regla puede tener ocurrencias
      // pendientes entre nextOccurrenceDate y dayBefore (si cutoff > next). Cron y
      // virtual generator respetan endDate automáticamente.
      .set({ endDate: dayBefore, updatedAt: sql`now()` })
      .where(eq(recurringRules.id, rule.id));

    // Materializa primera ocurrencia con la nueva regla.
    const [row] = await db
      .insert(transactions)
      .values({
        userId,
        accountId: newRule.accountId,
        counterAccountId: newRule.counterAccountId,
        categoryId: newRule.categoryId,
        debtId: newRule.debtId,
        savingsGoalId: newRule.savingsGoalId,
        kind: newRule.kind,
        amountMinor: newRule.amountMinor,
        currency: newRule.currency,
        transactionDate: cutoff,
        description: input.description ?? rule.name,
        notes: input.notes ?? null,
        recurringRuleId: newRule.id,
        // Recurrente materializada → sin confirmar (checkbox vacío).
        isPaid: false,
      })
      .onConflictDoNothing()
      .returning();
    return row ?? null;
  }

  // mode === 'this_one': override puntual de UNA ocurrencia
  const existing = await db.query.transactions.findFirst({
    where: and(
      eq(transactions.recurringRuleId, rule.id),
      eq(transactions.transactionDate, input.occurrenceDate),
    ),
  });

  if (existing) {
    const patch: Record<string, unknown> = { updatedAt: sql`now()` };
    if (input.amount !== undefined) patch.amountMinor = newAmountMinor;
    if (input.description !== undefined) patch.description = input.description;
    if (input.notes !== undefined) patch.notes = input.notes;
    if (input.categoryId !== undefined) patch.categoryId = input.categoryId;
    if (input.accountId !== undefined) patch.accountId = input.accountId;
    if (input.counterAccountId !== undefined) patch.counterAccountId = input.counterAccountId;
    const [row] = await db
      .update(transactions)
      .set(patch)
      .where(eq(transactions.id, existing.id))
      .returning();
    return row;
  }

  // No existe — materializar la fila con los valores override.
  const [row] = await db
    .insert(transactions)
    .values({
      userId,
      accountId: input.accountId ?? rule.accountId,
      counterAccountId:
        input.counterAccountId !== undefined ? input.counterAccountId : rule.counterAccountId,
      categoryId: input.categoryId !== undefined ? input.categoryId : rule.categoryId,
      debtId: rule.debtId,
      savingsGoalId: rule.savingsGoalId,
      kind: rule.kind,
      amountMinor: newAmountMinor,
      currency: rule.currency,
      transactionDate: input.occurrenceDate,
      description: input.description ?? rule.name,
      notes: input.notes ?? null,
      recurringRuleId: rule.id,
      // Recurrente materializada → sin confirmar (checkbox vacío).
      isPaid: false,
    })
    .onConflictDoNothing()
    .returning();
  return row ?? null;
}

/**
 * Borra una ocurrencia VIRTUAL.
 *
 * mode='this_one': "omite" inserta una fila con amount=0n y descripción "(omitido)".
 *   El cron no recreará por el unique index. Aparece en el listado como
 *   referencia de que ese mes se saltó.
 * mode='forward': cierra la regla en cutoff − 1 y borra futuras materializadas.
 */
export async function deleteVirtualOccurrence(userId: UserId, input: DeleteVirtualInput) {
  const rule = await db.query.recurringRules.findFirst({
    where: and(eq(recurringRules.id, input.ruleId), eq(recurringRules.userId, userId)),
  });
  if (!rule) throw new NotFoundError('Regla recurrente');

  if (input.mode === 'forward') {
    const cutoff = input.occurrenceDate;
    const dayBefore = dayjs(cutoff).subtract(1, 'day').format('YYYY-MM-DD');
    await db
      .update(recurringRules)
      // No seteamos isActive=false porque la regla puede tener ocurrencias
      // pendientes entre nextOccurrenceDate y dayBefore (si cutoff > next). Cron y
      // virtual generator respetan endDate automáticamente.
      .set({ endDate: dayBefore, updatedAt: sql`now()` })
      .where(eq(recurringRules.id, rule.id));
    await db
      .delete(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.recurringRuleId, rule.id),
          gte(transactions.transactionDate, cutoff),
        ),
      );
    return { ok: true } as const;
  }

  // this_one: omitir esa ocurrencia con amount=0
  const existing = await db.query.transactions.findFirst({
    where: and(
      eq(transactions.recurringRuleId, rule.id),
      eq(transactions.transactionDate, input.occurrenceDate),
    ),
  });

  if (existing) {
    await db
      .update(transactions)
      .set({ amountMinor: 0n, description: '(Omitido)', updatedAt: sql`now()` })
      .where(eq(transactions.id, existing.id));
  } else {
    await db
      .insert(transactions)
      .values({
        userId,
        accountId: rule.accountId,
        counterAccountId: rule.counterAccountId,
        categoryId: rule.categoryId,
        debtId: rule.debtId,
        savingsGoalId: rule.savingsGoalId,
        kind: rule.kind,
        amountMinor: 0n,
        currency: rule.currency,
        transactionDate: input.occurrenceDate,
        description: '(Omitido)',
        recurringRuleId: rule.id,
        isPaid: true,
      })
      .onConflictDoNothing();
  }
  return { ok: true } as const;
}

export const ALL_TRANSACTION_KINDS: TransactionKind[] = [
  'expense',
  'income',
  'refund',
  'transfer',
  'cc_charge',
  'cc_payment',
  'loan_payment',
  'loan_charge',
  'savings_contribution',
];

function ruleRowToVirtual(r: typeof recurringRules.$inferSelect): RecurringRuleForVirtuals {
  return {
    id: r.id,
    kind: r.kind,
    amountMinor: BigInt(r.amountMinor as unknown as string | number | bigint),
    currency: r.currency,
    frequency: r.frequency as RecurringRuleForVirtuals['frequency'],
    dayOfMonth: r.dayOfMonth,
    dayOfWeek: r.dayOfWeek,
    startDate: r.startDate,
    endDate: r.endDate,
    nextOccurrenceDate: r.nextOccurrenceDate,
    accountId: r.accountId,
    counterAccountId: r.counterAccountId,
    categoryId: r.categoryId,
    debtId: r.debtId,
    savingsGoalId: r.savingsGoalId,
    isActive: r.isActive,
  };
}
