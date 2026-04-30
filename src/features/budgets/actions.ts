'use server';

import { revalidatePath } from 'next/cache';
import { authedAction } from '@/lib/safe-action';
import { deleteBudget, updateBudget, upsertBudget } from './mutations';
import { budgetInputSchema, deleteBudgetSchema, updateBudgetSchema } from './schema';

export const upsertBudgetAction = authedAction
  .metadata({ actionName: 'upsertBudget' })
  .inputSchema(budgetInputSchema)
  .action(async ({ parsedInput, ctx }) => {
    const row = await upsertBudget(ctx.userId, parsedInput);
    revalidatePath('/presupuestos');
    revalidatePath('/dashboard');
    return row;
  });

export const updateBudgetAction = authedAction
  .metadata({ actionName: 'updateBudget' })
  .inputSchema(updateBudgetSchema)
  .action(async ({ parsedInput, ctx }) => {
    const row = await updateBudget(ctx.userId, parsedInput);
    revalidatePath('/presupuestos');
    return row;
  });

export const deleteBudgetAction = authedAction
  .metadata({ actionName: 'deleteBudget' })
  .inputSchema(deleteBudgetSchema)
  .action(async ({ parsedInput, ctx }) => {
    await deleteBudget(ctx.userId, parsedInput.id);
    revalidatePath('/presupuestos');
    return { ok: true };
  });
