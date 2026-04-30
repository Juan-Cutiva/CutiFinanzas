'use server';

import { eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { authedAction } from '@/lib/safe-action';
import { updateUserPreferencesSchema } from './schema';

export const updateUserPreferencesAction = authedAction
  .metadata({ actionName: 'updateUserPreferences' })
  .inputSchema(updateUserPreferencesSchema)
  .action(async ({ parsedInput, ctx }) => {
    const patch: Record<string, unknown> = { updatedAt: sql`now()` };
    if (parsedInput.defaultCurrency) patch.defaultCurrency = parsedInput.defaultCurrency;
    if (parsedInput.locale) patch.locale = parsedInput.locale;
    if (parsedInput.timezone) patch.timezone = parsedInput.timezone;
    if (parsedInput.name !== undefined) patch.name = parsedInput.name || null;
    if (parsedInput.payFrequency) patch.payFrequency = parsedInput.payFrequency;

    const [row] = await db.update(users).set(patch).where(eq(users.id, ctx.userId)).returning();

    revalidatePath('/ajustes');
    revalidatePath('/dashboard');
    return row;
  });
