'use server';

import { revalidateAfterBudget } from '@/lib/cache-tags';
import { authedAction } from '@/lib/safe-action';
import { deleteBudget, updateBudget, updateRecurringBudget, upsertBudget } from './mutations';
import {
  budgetInputSchema,
  deleteBudgetSchema,
  updateBudgetSchema,
  updateRecurringBudgetSchema,
} from './schema';

export const upsertBudgetAction = authedAction
  .metadata({ actionName: 'upsertBudget' })
  .inputSchema(budgetInputSchema)
  .action(async ({ parsedInput, ctx }) => {
    const row = await upsertBudget(ctx.userId, parsedInput);
    revalidateAfterBudget(ctx.userId);
    return row;
  });

export const updateBudgetAction = authedAction
  .metadata({ actionName: 'updateBudget' })
  .inputSchema(updateBudgetSchema)
  .action(async ({ parsedInput, ctx }) => {
    const row = await updateBudget(ctx.userId, parsedInput);
    revalidateAfterBudget(ctx.userId);
    return row;
  });

export const updateRecurringBudgetAction = authedAction
  .metadata({ actionName: 'updateRecurringBudget' })
  .inputSchema(updateRecurringBudgetSchema)
  .action(async ({ parsedInput, ctx }) => {
    const row = await updateRecurringBudget(ctx.userId, parsedInput);
    revalidateAfterBudget(ctx.userId);
    return row;
  });

export const deleteBudgetAction = authedAction
  .metadata({ actionName: 'deleteBudget' })
  .inputSchema(deleteBudgetSchema)
  .action(async ({ parsedInput, ctx }) => {
    await deleteBudget(ctx.userId, parsedInput.id);
    revalidateAfterBudget(ctx.userId);
    return { ok: true };
  });
