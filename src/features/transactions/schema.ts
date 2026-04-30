import { z } from 'zod';

const TX_KINDS = [
  'income',
  'expense_fixed',
  'expense_variable',
  'transfer',
  'debt_payment',
  'savings_contribution',
] as const;

export const TX_KIND_LABELS: Record<(typeof TX_KINDS)[number], string> = {
  income: 'Ingreso',
  expense_fixed: 'Gasto fijo',
  expense_variable: 'Gasto variable',
  transfer: 'Transferencia',
  debt_payment: 'Pago de deuda',
  savings_contribution: 'Aporte a ahorro',
};

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)');

export const transactionInputSchema = z
  .object({
    accountId: z.string().min(1, 'Cuenta requerida'),
    transferAccountId: z.string().nullable().optional(),
    categoryId: z.string().nullable().optional(),
    kind: z.enum(TX_KINDS),
    amount: z.coerce.number().positive('El monto debe ser positivo'),
    currency: z.string().length(3).toUpperCase(),
    occurredAt: isoDate,
    description: z.string().trim().max(200).optional(),
    notes: z.string().trim().max(2000).optional(),
    isPaid: z.boolean().default(true),
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
    if (data.kind !== 'transfer' && data.kind !== 'income' && !data.categoryId) {
      ctx.addIssue({
        code: 'custom',
        message: 'Selecciona una categoría',
        path: ['categoryId'],
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
  description: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  categoryId: z.string().nullable().optional(),
  isPaid: z.boolean().optional(),
});
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;

export const deleteTransactionSchema = z.object({ id: z.string().min(1) });

export const listTransactionsSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
});

export { TX_KINDS };
