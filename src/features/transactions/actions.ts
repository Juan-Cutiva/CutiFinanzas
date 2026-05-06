'use server';

import { getProjectedBalanceMinor, monthRange } from '@/lib/accounting';
import { revalidateAfterTransaction } from '@/lib/cache-tags';
import { nowInTz } from '@/lib/format';
import { authedAction } from '@/lib/safe-action';
import {
  createTransaction,
  deleteRecurring,
  deleteTransaction,
  deleteVirtualOccurrence,
  editVirtualOccurrence,
  togglePaid,
  updateRecurring,
  updateTransaction,
} from './mutations';
import {
  createTransactionSchema,
  deleteRecurringSchema,
  deleteTransactionSchema,
  deleteVirtualSchema,
  editVirtualSchema,
  getAccountProjectionSchema,
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

export const editVirtualAction = authedAction
  .metadata({ actionName: 'editVirtual' })
  .inputSchema(editVirtualSchema)
  .action(async ({ parsedInput, ctx }) => {
    const row = await editVirtualOccurrence(ctx.userId, parsedInput);
    revalidateAfterTransaction(ctx.userId);
    return row;
  });

export const deleteVirtualAction = authedAction
  .metadata({ actionName: 'deleteVirtual' })
  .inputSchema(deleteVirtualSchema)
  .action(async ({ parsedInput, ctx }) => {
    await deleteVirtualOccurrence(ctx.userId, parsedInput);
    revalidateAfterTransaction(ctx.userId);
    return { ok: true };
  });

/**
 * Devuelve el saldo proyectado al cierre del mes (YYYY-MM) para una cuenta.
 * Lazy: se invoca desde el form de Quick Add solo cuando el usuario elige
 * una fecha en un mes futuro distinto al actual.
 */
export const getAccountProjectionAction = authedAction
  .metadata({ actionName: 'getAccountProjection' })
  .inputSchema(getAccountProjectionSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { accountId, ym } = parsedInput;
    const [yearStr, monthStr] = ym.split('-');
    const year = Number.parseInt(yearStr ?? '', 10);
    const month = Number.parseInt(monthStr ?? '', 10);
    const { to } = monthRange(year, month);
    const today = nowInTz(ctx.user.timezone).format('YYYY-MM-DD');
    const result = await getProjectedBalanceMinor(ctx.userId, accountId, to, today);
    return {
      accountId,
      ym,
      projectedMinor: result.projectedMinor.toString(),
    };
  });
