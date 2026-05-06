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
    if (parsedInput.payAnchorDates !== undefined) {
      const sanitized = Array.from(
        new Set(parsedInput.payAnchorDates.map((n) => Math.max(1, Math.min(31, Math.trunc(n))))),
      ).sort((a, b) => a - b);
      patch.payAnchorDates = sanitized;
    }
    if (parsedInput.primaryAccountId !== undefined) {
      patch.primaryAccountId = parsedInput.primaryAccountId || null;
    }
    if (parsedInput.dashboardAccountIds !== undefined) {
      patch.dashboardAccountIds =
        parsedInput.dashboardAccountIds && parsedInput.dashboardAccountIds.length > 0
          ? parsedInput.dashboardAccountIds
          : null;
    }

    const [row] = await db.update(users).set(patch).where(eq(users.id, ctx.userId)).returning();
    revalidatePath('/ajustes');
    revalidatePath('/dashboard');
    return row;
  });
