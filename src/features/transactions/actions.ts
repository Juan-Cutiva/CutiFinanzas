'use server';

import { revalidateAfterTransaction } from '@/lib/cache-tags';
import { authedAction } from '@/lib/safe-action';
import {
  createTransaction,
  deleteTransaction,
  updateRecurringTransaction,
  updateTransaction,
} from './mutations';
import {
  deleteTransactionSchema,
  transactionInputSchema,
  updateRecurringTransactionSchema,
  updateTransactionSchema,
} from './schema';

export const createTransactionAction = authedAction
  .metadata({ actionName: 'createTransaction' })
  .inputSchema(transactionInputSchema)
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

export const updateRecurringTransactionAction = authedAction
  .metadata({ actionName: 'updateRecurringTransaction' })
  .inputSchema(updateRecurringTransactionSchema)
  .action(async ({ parsedInput, ctx }) => {
    const row = await updateRecurringTransaction(ctx.userId, parsedInput);
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
