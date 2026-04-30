import { z } from 'zod';

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es requerido').max(100, 'Máximo 100 caracteres'),
  icon: z.string().trim().min(1).max(64).default('Tag'),
  color: z.string().trim().min(1).max(32).default('var(--chart-1)'),
  parentId: z.string().nullable().optional(),
  sortOrder: z.number().int().min(0).default(0),
});

export type CategoryInput = z.infer<typeof categoryInputSchema>;

export const updateCategorySchema = categoryInputSchema.partial().extend({
  id: z.string().min(1),
});
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export const deleteCategorySchema = z.object({ id: z.string().min(1) });

export const DEFAULT_CATEGORIES: Array<
  Omit<CategoryInput, 'parentId' | 'sortOrder'> & { sortOrder: number }
> = [
  { name: 'Casa', icon: 'Home', color: 'oklch(0.610 0.190 318)', sortOrder: 0 },
  { name: 'Transporte', icon: 'Car', color: 'oklch(0.700 0.135 230)', sortOrder: 1 },
  { name: 'Telecomunicaciones', icon: 'Smartphone', color: 'oklch(0.620 0.135 230)', sortOrder: 2 },
  { name: 'Entretenimiento', icon: 'Music', color: 'oklch(0.760 0.170 350)', sortOrder: 3 },
  { name: 'Cuidado Personal', icon: 'Sparkles', color: 'oklch(0.700 0.180 350)', sortOrder: 4 },
  { name: 'Deudas', icon: 'CreditCard', color: 'oklch(0.580 0.220 25)', sortOrder: 5 },
  { name: 'Finanzas', icon: 'Banknote', color: 'oklch(0.620 0.170 155)', sortOrder: 6 },
  { name: 'Moto', icon: 'Bike', color: 'oklch(0.720 0.155 75)', sortOrder: 7 },
  { name: 'Otros', icon: 'Tag', color: 'oklch(0.480 0.020 318)', sortOrder: 8 },
];
