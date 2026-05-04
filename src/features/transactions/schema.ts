import { z } from 'zod';

const TX_KINDS = [
  'income_fixed',
  'income_variable',
  'expense_fixed',
  'expense_variable',
  'transfer',
  'credit_card_payment',
  'debt_payment',
  'savings_contribution',
  'refund',
] as const;

export const TX_KIND_LABELS: Record<(typeof TX_KINDS)[number], string> = {
  income_fixed: 'Ingreso fijo (salario, renta…)',
  income_variable: 'Ingreso variable (extra, bonificación…)',
  expense_fixed: 'Gasto fijo (suscripciones, arriendo…)',
  expense_variable: 'Gasto variable (mercado, gasolina…)',
  transfer: 'Transferencia entre cuentas',
  credit_card_payment: 'Pago de tarjeta de crédito',
  debt_payment: 'Pago de deuda (préstamo, financiación)',
  savings_contribution: 'Aporte a meta de ahorro',
  refund: 'Devolución / reembolso',
};

/**
 * Categorías primarias que el usuario elige primero en el form,
 * antes de afinar con la frecuencia (fijo/variable).
 */
export const TX_PRIMARY_KINDS = [
  'income',
  'expense',
  'credit_card_payment',
  'debt_payment',
  'transfer',
  'savings_contribution',
  'refund',
] as const;

export type PrimaryKind = (typeof TX_PRIMARY_KINDS)[number];

export const PRIMARY_KIND_LABELS: Record<PrimaryKind, string> = {
  income: 'Ingreso',
  expense: 'Gasto',
  credit_card_payment: 'Pago de tarjeta de crédito',
  debt_payment: 'Pago de deuda',
  transfer: 'Transferencia entre cuentas',
  savings_contribution: 'Aporte a meta de ahorro',
  refund: 'Devolución / reembolso',
};

/** Kinds primarios que aceptan elección Fijo/Variable. */
export const KINDS_WITH_FREQUENCY = new Set<PrimaryKind>([
  'income',
  'expense',
  'credit_card_payment',
  'debt_payment',
]);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)');

export const transactionInputSchema = z
  .object({
    accountId: z.string().min(1, 'Cuenta requerida'),
    transferAccountId: z.string().nullable().optional(),
    categoryId: z.string().nullable().optional(),
    debtId: z.string().nullable().optional(),
    savingsGoalId: z.string().nullable().optional(),
    kind: z.enum(TX_KINDS),
    amount: z.coerce.number().positive('El monto debe ser positivo'),
    currency: z.string().length(3).toUpperCase(),
    occurredAt: isoDate,
    description: z.string().trim().max(200).optional(),
    notes: z.string().trim().max(2000).optional(),
    isPaid: z.boolean().default(true),
    isRecurring: z.boolean().default(false),
    receiptUrl: z.string().url().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.kind === 'transfer' && !data.transferAccountId) {
      ctx.addIssue({
        code: 'custom',
        message: 'Las transferencias requieren cuenta destino',
        path: ['transferAccountId'],
      });
    }
    if (data.kind === 'credit_card_payment' && !data.transferAccountId) {
      ctx.addIssue({
        code: 'custom',
        message: 'Selecciona la tarjeta a la que estás pagando',
        path: ['transferAccountId'],
      });
    }
    if ((data.kind === 'expense_fixed' || data.kind === 'expense_variable') && !data.categoryId) {
      ctx.addIssue({
        code: 'custom',
        message: 'Selecciona una categoría',
        path: ['categoryId'],
      });
    }
    if (data.kind === 'debt_payment' && !data.debtId) {
      ctx.addIssue({
        code: 'custom',
        message: 'Selecciona la deuda a la que aplica el pago',
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
    if (data.transferAccountId && data.transferAccountId === data.accountId) {
      ctx.addIssue({
        code: 'custom',
        message: 'Las cuentas origen y destino deben ser distintas',
        path: ['transferAccountId'],
      });
    }
  });

export type TransactionInput = z.infer<typeof transactionInputSchema>;

export const updateTransactionSchema = z.object({
  id: z.string().min(1),
  amount: z.coerce.number().positive().optional(),
  description: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  categoryId: z.string().nullable().optional(),
  isPaid: z.boolean().optional(),
});
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;

export const updateRecurringTransactionSchema = z.object({
  id: z.string().min(1),
  amount: z.coerce.number().positive('El monto debe ser positivo'),
  description: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  categoryId: z.string().nullable().optional(),
  mode: z.enum(['this_month', 'forward']),
});
export type UpdateRecurringTransactionInput = z.infer<typeof updateRecurringTransactionSchema>;

export const togglePaidSchema = z.object({
  id: z.string().min(1),
  isPaid: z.boolean(),
});
export type TogglePaidInput = z.infer<typeof togglePaidSchema>;

export const deleteTransactionSchema = z.object({ id: z.string().min(1) });

export const listTransactionsSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
});

export { TX_KINDS };
