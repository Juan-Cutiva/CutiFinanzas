import { z } from 'zod';
import { ALL_KINDS, KIND_LABELS, type TransactionKind } from '@/lib/accounting/shared';

export type { TransactionKind };
export { ALL_KINDS, KIND_LABELS };

export const RECURRENCE_FREQUENCIES = [
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'yearly',
] as const;
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

export const RECURRENCE_LABELS: Record<RecurrenceFrequency, string> = {
  weekly: 'Semanal',
  biweekly: 'Quincenal',
  monthly: 'Mensual',
  quarterly: 'Trimestral',
  yearly: 'Anual',
};

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)');
const allKindEnum = z.enum(ALL_KINDS as unknown as [TransactionKind, ...TransactionKind[]]);

/**
 * Input para crear una transacción (puntual o recurrente).
 *
 * - Si `recurrence` es null → puntual: se inserta una sola fila en `transactions`.
 * - Si `recurrence` está definido → recurrente: se crea una `recurring_rule` y
 *   se materializa la primera ocurrencia (transactionDate) como fila en `transactions`,
 *   marcada con recurringRuleId. El cron materializa las siguientes al pasar la fecha.
 */
export const createTransactionSchema = z
  .object({
    kind: allKindEnum,
    accountId: z.string().min(1, 'Cuenta requerida'),
    counterAccountId: z.string().nullable().optional(),
    categoryId: z.string().nullable().optional(),
    debtId: z.string().nullable().optional(),
    savingsGoalId: z.string().nullable().optional(),
    amount: z.coerce.number().positive('El monto debe ser positivo'),
    currency: z.string().length(3).toUpperCase(),
    transactionDate: isoDate,
    description: z.string().trim().max(200).optional(),
    notes: z.string().trim().max(2000).optional(),
    receiptUrl: z.string().url().optional(),
    recurrence: z
      .object({
        frequency: z.enum(RECURRENCE_FREQUENCIES),
        dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
        endDate: isoDate.nullable().optional(),
        name: z.string().trim().min(1).max(200),
      })
      .nullable()
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.kind === 'transfer' && !data.counterAccountId) {
      ctx.addIssue({
        code: 'custom',
        message: 'Las transferencias requieren cuenta destino',
        path: ['counterAccountId'],
      });
    }
    if (data.kind === 'cc_payment' && !data.counterAccountId) {
      ctx.addIssue({
        code: 'custom',
        message: 'Selecciona la tarjeta a la que pagas',
        path: ['counterAccountId'],
      });
    }
    if (data.kind === 'expense' && !data.categoryId) {
      ctx.addIssue({
        code: 'custom',
        message: 'Selecciona una categoría',
        path: ['categoryId'],
      });
    }
    if (data.kind === 'cc_charge' && !data.categoryId) {
      ctx.addIssue({
        code: 'custom',
        message: 'Selecciona una categoría para la compra',
        path: ['categoryId'],
      });
    }
    if (data.kind === 'loan_payment' && !data.debtId) {
      ctx.addIssue({
        code: 'custom',
        message: 'Selecciona el préstamo',
        path: ['debtId'],
      });
    }
    if (data.kind === 'savings_contribution' && !data.savingsGoalId) {
      ctx.addIssue({
        code: 'custom',
        message: 'Selecciona la meta de ahorro',
        path: ['savingsGoalId'],
      });
    }
    if (data.counterAccountId && data.counterAccountId === data.accountId) {
      ctx.addIssue({
        code: 'custom',
        message: 'Origen y destino deben ser distintas',
        path: ['counterAccountId'],
      });
    }
  });
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

/**
 * Edita una transacción puntual (no recurrente) o una ocurrencia individual de recurrente.
 * No cambia el `kind` (eso requeriría borrar y recrear).
 */
export const updateTransactionSchema = z.object({
  id: z.string().min(1),
  amount: z.coerce.number().positive().optional(),
  transactionDate: isoDate.optional(),
  accountId: z.string().min(1).optional(),
  counterAccountId: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  debtId: z.string().nullable().optional(),
  savingsGoalId: z.string().nullable().optional(),
  description: z.string().trim().max(200).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  receiptUrl: z.string().url().nullable().optional(),
  isPaid: z.boolean().optional(),
});
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;

/**
 * Edita una regla recurrente. mode='this_one' edita solo la ocurrencia (fila concreta);
 * mode='forward' cierra la regla actual con endDate=día anterior a la fecha del cambio
 * y crea una nueva regla con los nuevos valores desde esa fecha en adelante.
 */
export const updateRecurringSchema = z.object({
  /** ID de la transacción (instance) que se está editando. */
  transactionId: z.string().min(1),
  amount: z.coerce.number().positive().optional(),
  description: z.string().trim().max(200).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  categoryId: z.string().nullable().optional(),
  accountId: z.string().min(1).optional(),
  counterAccountId: z.string().nullable().optional(),
  receiptUrl: z.string().url().nullable().optional(),
  mode: z.enum(['this_one', 'forward']),
});
export type UpdateRecurringInput = z.infer<typeof updateRecurringSchema>;

export const togglePaidSchema = z.object({
  id: z.string().min(1),
  isPaid: z.boolean(),
});
export type TogglePaidInput = z.infer<typeof togglePaidSchema>;

export const deleteTransactionSchema = z.object({ id: z.string().min(1) });

export const deleteRecurringSchema = z.object({
  transactionId: z.string().min(1),
  mode: z.enum(['this_one', 'forward']),
});
export type DeleteRecurringInput = z.infer<typeof deleteRecurringSchema>;
