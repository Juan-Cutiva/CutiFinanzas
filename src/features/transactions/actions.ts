'use server';

import { revalidateAfterTransaction } from '@/lib/cache-tags';
import { authedAction } from '@/lib/safe-action';
import {
  createTransaction,
  deleteRecurringTransaction,
  deleteTransaction,
  togglePaid,
  updateRecurringTransaction,
  updateTransaction,
  updateTransactionFull,
} from './mutations';
import {
  deleteRecurringTransactionSchema,
  deleteTransactionSchema,
  togglePaidSchema,
  transactionInputSchema,
  updateRecurringTransactionSchema,
  updateTransactionFullSchema,
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

export const togglePaidAction = authedAction
  .metadata({ actionName: 'togglePaid' })
  .inputSchema(togglePaidSchema)
  .action(async ({ parsedInput, ctx }) => {
    const row = await togglePaid(ctx.userId, parsedInput);
    revalidateAfterTransaction(ctx.userId);
    return row;
  });

export const updateTransactionFullAction = authedAction
  .metadata({ actionName: 'updateTransactionFull' })
  .inputSchema(updateTransactionFullSchema)
  .action(async ({ parsedInput, ctx }) => {
    const row = await updateTransactionFull(ctx.userId, parsedInput);
    revalidateAfterTransaction(ctx.userId);
    return row;
  });

export const deleteRecurringTransactionAction = authedAction
  .metadata({ actionName: 'deleteRecurringTransaction' })
  .inputSchema(deleteRecurringTransactionSchema)
  .action(async ({ parsedInput, ctx }) => {
    const row = await deleteRecurringTransaction(ctx.userId, parsedInput);
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
