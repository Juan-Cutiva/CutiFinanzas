'use server';

import { revalidatePath } from 'next/cache';
import { authedAction } from '@/lib/safe-action';
import { createDebt, deleteDebt, updateDebt } from './mutations';
import { debtInputSchema, deleteDebtSchema, updateDebtSchema } from './schema';

export const createDebtAction = authedAction
  .metadata({ actionName: 'createDebt' })
  .inputSchema(debtInputSchema)
  .action(async ({ parsedInput, ctx }) => {
    const row = await createDebt(ctx.userId, parsedInput);
    revalidatePath('/deudas');
    revalidatePath('/dashboard');
    return row;
  });

export const updateDebtAction = authedAction
  .metadata({ actionName: 'updateDebt' })
  .inputSchema(updateDebtSchema)
  .action(async ({ parsedInput, ctx }) => {
    const row = await updateDebt(ctx.userId, parsedInput);
    revalidatePath('/deudas');
    return row;
  });

export const deleteDebtAction = authedAction
  .metadata({ actionName: 'deleteDebt' })
  .inputSchema(deleteDebtSchema)
  .action(async ({ parsedInput, ctx }) => {
    await deleteDebt(ctx.userId, parsedInput.id);
    revalidatePath('/deudas');
    return { ok: true };
  });
