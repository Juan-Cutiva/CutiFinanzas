import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)');

export const debtInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  principal: z.coerce.number().positive(),
  currency: z.string().length(3).toUpperCase(),
  interestRateAnnual: z.coerce.number().min(0).max(100).optional(),
  monthlyPayment: z.coerce.number().nonnegative(),
  startDate: isoDate,
  endDate: isoDate.optional(),
  totalInstallments: z.coerce.number().int().positive().optional(),
  notes: z.string().trim().max(2000).optional(),
});
export type DebtInput = z.infer<typeof debtInputSchema>;

export const updateDebtSchema = debtInputSchema.partial().extend({
  id: z.string().min(1),
  status: z.enum(['active', 'paid_off']).optional(),
});
export type UpdateDebtInput = z.infer<typeof updateDebtSchema>;

export const deleteDebtSchema = z.object({ id: z.string().min(1) });
