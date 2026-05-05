import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)');

export const debtInputSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    principal: z.coerce.number().positive(),
    currentBalance: z.coerce.number().nonnegative(),
    currency: z.string().length(3).toUpperCase(),
    interestRateAnnual: z.coerce.number().min(0).max(100).optional(),
    monthlyPayment: z.coerce.number().nonnegative(),
    startDate: isoDate,
    endDate: isoDate.optional(),
    totalInstallments: z.coerce.number().int().positive().optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.currentBalance > data.principal) {
      ctx.addIssue({
        code: 'custom',
        message: 'El capital actual no puede ser mayor que el inicial',
        path: ['currentBalance'],
      });
    }
  });
export type DebtInput = z.infer<typeof debtInputSchema>;

export const updateDebtSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(200).optional(),
  principal: z.coerce.number().positive().optional(),
  currentBalance: z.coerce.number().nonnegative().optional(),
  currency: z.string().length(3).toUpperCase().optional(),
  interestRateAnnual: z.coerce.number().min(0).max(100).optional(),
  monthlyPayment: z.coerce.number().nonnegative().optional(),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  totalInstallments: z.coerce.number().int().positive().optional(),
  notes: z.string().trim().max(2000).optional(),
  status: z.enum(['active', 'paid_off']).optional(),
});
export type UpdateDebtInput = z.infer<typeof updateDebtSchema>;

export const deleteDebtSchema = z.object({ id: z.string().min(1) });
