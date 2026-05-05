'use server';

import { revalidateAfterTransaction } from '@/lib/cache-tags';
import { authedAction } from '@/lib/safe-action';
import {
  createTransaction,
  deleteRecurring,
  deleteTransaction,
  togglePaid,
  updateRecurring,
  updateTransaction,
} from './mutations';
import {
  createTransactionSchema,
  deleteRecurringSchema,
  deleteTransactionSchema,
  togglePaidSchema,
  updateRecurringSchema,
  updateTransactionSchema,
} from './schema';

export const createTransactionAction = authedAction
  .metadata({ actionName: 'createTransaction' })
  .inputSchema(createTransactionSchema)
  .action(async ({ parsedInput, ctx }) => {
    const row = await createTransaction(ctx.userId, parsedInput);
    revalidateAfterTransaction(ctx.userId);
    return row;
  });

export const updateTransactionAction = authedAction
  .metadata({ actionName: 'updateTransaction' })
  .inputSchema(updateTransactionSchema)
  .action(async ({ parsedInput, ctx }) => {
    const row = await updateTransaction(ctx.userId, parsedInput);
    revalidateAfterTransaction(ctx.userId);
    return row;
  });

export const updateRecurringAction = authedAction
  .metadata({ actionName: 'updateRecurring' })
  .inputSchema(updateRecurringSchema)
  .action(async ({ parsedInput, ctx }) => {
    const row = await updateRecurring(ctx.userId, parsedInput);
    revalidateAfterTransaction(ctx.userId);
    return row;
  });

export const togglePaidAction = authedAction
  .metadata({ actionName: 'togglePaid' })
  .inputSchema(togglePaidSchema)
  .action(async ({ parsedInput, ctx }) => {
    const row = await togglePaid(ctx.userId, parsedInput);
    revalidateAfterTransaction(ctx.userId);
    return row;
  });

export const deleteTransactionAction = authedAction
  .metadata({ actionName: 'deleteTransaction' })
  .inputSchema(deleteTransactionSchema)
  .action(async ({ parsedInput, ctx }) => {
    await deleteTransaction(ctx.userId, parsedInput.id);
    revalidateAfterTransaction(ctx.userId);
    return { ok: true };
  });

export const deleteRecurringAction = authedAction
  .metadata({ actionName: 'deleteRecurring' })
  .inputSchema(deleteRecurringSchema)
  .action(async ({ parsedInput, ctx }) => {
    await deleteRecurring(ctx.userId, parsedInput);
    revalidateAfterTransaction(ctx.userId);
    return { ok: true };
  });
