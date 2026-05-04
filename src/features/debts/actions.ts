'use server';

import { revalidateAfterDebt } from '@/lib/cache-tags';
import { authedAction } from '@/lib/safe-action';
import { createDebt, deleteDebt, recordDebtUsage, updateDebt } from './mutations';
import {
  debtInputSchema,
  deleteDebtSchema,
  recordDebtUsageSchema,
  updateDebtSchema,
} from './schema';

export const createDebtAction = authedAction
  .metadata({ actionName: 'createDebt' })
  .inputSchema(debtInputSchema)
  .action(async ({ parsedInput, ctx }) => {
    const row = await createDebt(ctx.userId, parsedInput);
    revalidateAfterDebt(ctx.userId);
    return row;
  });

export const updateDebtAction = authedAction
  .metadata({ actionName: 'updateDebt' })
  .inputSchema(updateDebtSchema)
  .action(async ({ parsedInput, ctx }) => {
    const row = await updateDebt(ctx.userId, parsedInput);
    revalidateAfterDebt(ctx.userId);
    return row;
  });

export const recordDebtUsageAction = authedAction
  .metadata({ actionName: 'recordDebtUsage' })
  .inputSchema(recordDebtUsageSchema)
  .action(async ({ parsedInput, ctx }) => {
    const row = await recordDebtUsage(ctx.userId, parsedInput);
    revalidateAfterDebt(ctx.userId);
    return row;
  });

export const deleteDebtAction = authedAction
  .metadata({ actionName: 'deleteDebt' })
  .inputSchema(deleteDebtSchema)
  .action(async ({ parsedInput, ctx }) => {
    await deleteDebt(ctx.userId, parsedInput.id);
    revalidateAfterDebt(ctx.userId);
    return { ok: true };
  });
