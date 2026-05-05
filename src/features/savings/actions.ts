'use server';

import { revalidateAfterSavings } from '@/lib/cache-tags';
import { authedAction } from '@/lib/safe-action';
import { createSavingsGoal, deleteSavingsGoal, updateSavingsGoal } from './mutations';
import { deleteSavingsGoalSchema, savingsGoalInputSchema, updateSavingsGoalSchema } from './schema';

export const createSavingsGoalAction = authedAction
  .metadata({ actionName: 'createSavingsGoal' })
  .inputSchema(savingsGoalInputSchema)
  .action(async ({ parsedInput, ctx }) => {
    const row = await createSavingsGoal(ctx.userId, parsedInput);
    revalidateAfterSavings(ctx.userId);
    return row;
  });

export const updateSavingsGoalAction = authedAction
  .metadata({ actionName: 'updateSavingsGoal' })
  .inputSchema(updateSavingsGoalSchema)
  .action(async ({ parsedInput, ctx }) => {
    const row = await updateSavingsGoal(ctx.userId, parsedInput);
    revalidateAfterSavings(ctx.userId);
    return row;
  });

export const deleteSavingsGoalAction = authedAction
  .metadata({ actionName: 'deleteSavingsGoal' })
  .inputSchema(deleteSavingsGoalSchema)
  .action(async ({ parsedInput, ctx }) => {
    await deleteSavingsGoal(ctx.userId, parsedInput.id);
    revalidateAfterSavings(ctx.userId);
    return { ok: true };
  });
