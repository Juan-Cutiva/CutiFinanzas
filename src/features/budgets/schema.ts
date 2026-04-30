import { z } from 'zod';

const PERIODS = ['monthly', 'quincena_1', 'quincena_2'] as const;

export const PERIOD_LABELS: Record<(typeof PERIODS)[number], string> = {
  monthly: 'Mensual',
  quincena_1: 'Quincena 1',
  quincena_2: 'Quincena 2',
};

export const budgetInputSchema = z.object({
  categoryId: z.string().min(1, 'Categoría requerida'),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  period: z.enum(PERIODS).default('monthly'),
  amount: z.coerce.number().nonnegative(),
  currency: z.string().length(3).toUpperCase(),
  notes: z.string().trim().max(500).optional(),
});
export type BudgetInput = z.infer<typeof budgetInputSchema>;

export const updateBudgetSchema = z.object({
  id: z.string().min(1),
  amount: z.coerce.number().nonnegative().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;

export const deleteBudgetSchema = z.object({ id: z.string().min(1) });
export { PERIODS };
