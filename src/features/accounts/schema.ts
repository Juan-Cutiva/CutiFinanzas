import { z } from 'zod';

const ACCOUNT_TYPES = [
  'cash',
  'debit',
  'savings',
  'credit_card',
  'loan',
  'investment',
  'other',
] as const;

export const ACCOUNT_TYPE_LABELS: Record<(typeof ACCOUNT_TYPES)[number], string> = {
  cash: 'Efectivo',
  debit: 'Débito',
  savings: 'Ahorros',
  credit_card: 'Tarjeta de crédito',
  loan: 'Préstamo',
  investment: 'Inversión',
  other: 'Otro',
};

export const accountInputSchema = z
  .object({
    name: z.string().trim().min(1, 'Nombre requerido').max(100),
    type: z.enum(ACCOUNT_TYPES),
    currency: z.string().length(3, 'Código ISO de 3 letras').toUpperCase(),
    initialBalance: z.coerce.number().default(0),
    creditLimit: z.coerce.number().nonnegative().optional(),
    statementDay: z.coerce.number().int().min(1).max(31).optional(),
    paymentDueDay: z.coerce.number().int().min(1).max(31).optional(),
    institution: z.string().trim().max(100).optional(),
    icon: z.string().trim().max(64).default('Wallet'),
    color: z.string().trim().max(32).default('var(--chart-1)'),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'credit_card') {
      if (data.creditLimit === undefined) {
        ctx.addIssue({
          code: 'custom',
          message: 'Las tarjetas de crédito requieren un cupo',
          path: ['creditLimit'],
        });
      }
    }
  });

export type AccountInput = z.infer<typeof accountInputSchema>;

export const updateAccountSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(100).optional(),
  institution: z.string().trim().max(100).nullable().optional(),
  icon: z.string().trim().max(64).optional(),
  color: z.string().trim().max(32).optional(),
});
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

export const archiveAccountSchema = z.object({ id: z.string().min(1) });

export { ACCOUNT_TYPES };
