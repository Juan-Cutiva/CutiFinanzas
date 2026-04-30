'use server';

import { revalidatePath } from 'next/cache';
import { authedAction } from '@/lib/safe-action';
import { archiveAccount, createAccount, updateAccount } from './mutations';
import { accountInputSchema, archiveAccountSchema, updateAccountSchema } from './schema';

export const createAccountAction = authedAction
  .metadata({ actionName: 'createAccount' })
  .inputSchema(accountInputSchema)
  .action(async ({ parsedInput, ctx }) => {
    const row = await createAccount(ctx.userId, parsedInput);
    revalidatePath('/cuentas');
    revalidatePath('/dashboard');
    return row;
  });

export const updateAccountAction = authedAction
  .metadata({ actionName: 'updateAccount' })
  .inputSchema(updateAccountSchema)
  .action(async ({ parsedInput, ctx }) => {
    const row = await updateAccount(ctx.userId, parsedInput);
    revalidatePath('/cuentas');
    return row;
  });

export const archiveAccountAction = authedAction
  .metadata({ actionName: 'archiveAccount' })
  .inputSchema(archiveAccountSchema)
  .action(async ({ parsedInput, ctx }) => {
    await archiveAccount(ctx.userId, parsedInput.id);
    revalidatePath('/cuentas');
    revalidatePath('/dashboard');
    return { ok: true };
  });
