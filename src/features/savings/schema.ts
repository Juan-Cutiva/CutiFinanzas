import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)');

export const savingsGoalInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  targetAmount: z.coerce.number().positive(),
  currentAmount: z.coerce.number().nonnegative().default(0),
  monthlyContribution: z.coerce.number().nonnegative().default(0),
  currency: z.string().length(3).toUpperCase(),
  startDate: isoDate,
  targetDate: isoDate.optional(),
  icon: z.string().trim().max(64).default('PiggyBank'),
  color: z.string().trim().max(32).default('var(--chart-2)'),
  notes: z.string().trim().max(1000).optional(),
  accountId: z.string().nullable().optional(),
});
export type SavingsGoalInput = z.infer<typeof savingsGoalInputSchema>;

export const updateSavingsGoalSchema = savingsGoalInputSchema.partial().extend({
  id: z.string().min(1),
});
export type UpdateSavingsGoalInput = z.infer<typeof updateSavingsGoalSchema>;

export const deleteSavingsGoalSchema = z.object({ id: z.string().min(1) });

export const contributeSchema = z.object({
  id: z.string().min(1),
  amount: z.coerce.number().positive(),
  accountId: z.string().min(1, 'Cuenta requerida'),
  occurredAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')
    .optional(),
});
export type ContributeInput = z.infer<typeof contributeSchema>;
