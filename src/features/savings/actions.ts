'use server';

import { revalidatePath } from 'next/cache';
import { authedAction } from '@/lib/safe-action';
import {
  contributeToGoal,
  createSavingsGoal,
  deleteSavingsGoal,
  updateSavingsGoal,
} from './mutations';
import {
  contributeSchema,
  deleteSavingsGoalSchema,
  savingsGoalInputSchema,
  updateSavingsGoalSchema,
} from './schema';

export const createSavingsGoalAction = authedAction
  .metadata({ actionName: 'createSavingsGoal' })
  .inputSchema(savingsGoalInputSchema)
  .action(async ({ parsedInput, ctx }) => {
    const row = await createSavingsGoal(ctx.userId, parsedInput);
    revalidatePath('/ahorros');
    revalidatePath('/dashboard');
    return row;
  });

export const updateSavingsGoalAction = authedAction
  .metadata({ actionName: 'updateSavingsGoal' })
  .inputSchema(updateSavingsGoalSchema)
  .action(async ({ parsedInput, ctx }) => {
    const row = await updateSavingsGoal(ctx.userId, parsedInput);
    revalidatePath('/ahorros');
    return row;
  });

export const contributeToGoalAction = authedAction
  .metadata({ actionName: 'contributeToGoal' })
  .inputSchema(contributeSchema)
  .action(async ({ parsedInput, ctx }) => {
    const row = await contributeToGoal(ctx.userId, parsedInput);
    revalidatePath('/ahorros');
    revalidatePath('/dashboard');
    return row;
  });

export const deleteSavingsGoalAction = authedAction
  .metadata({ actionName: 'deleteSavingsGoal' })
  .inputSchema(deleteSavingsGoalSchema)
  .action(async ({ parsedInput, ctx }) => {
    await deleteSavingsGoal(ctx.userId, parsedInput.id);
    revalidatePath('/ahorros');
    return { ok: true };
  });
