'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/db/client';
import { pushSubscriptions } from '@/db/schema';
import { authedAction } from '@/lib/safe-action';

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  authKey: z.string().min(1),
  userAgent: z.string().optional(),
});

export const subscribePushAction = authedAction
  .metadata({ actionName: 'subscribePush' })
  .inputSchema(subscriptionSchema)
  .action(async ({ parsedInput, ctx }) => {
    await db
      .insert(pushSubscriptions)
      .values({ ...parsedInput, userId: ctx.userId })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          p256dh: parsedInput.p256dh,
          authKey: parsedInput.authKey,
          userAgent: parsedInput.userAgent ?? null,
        },
      });
    revalidatePath('/ajustes');
    return { ok: true };
  });

export const unsubscribePushAction = authedAction
  .metadata({ actionName: 'unsubscribePush' })
  .inputSchema(z.object({ endpoint: z.string().url() }))
  .action(async ({ parsedInput, ctx }) => {
    await db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, ctx.userId),
          eq(pushSubscriptions.endpoint, parsedInput.endpoint),
        ),
      );
    revalidatePath('/ajustes');
    return { ok: true };
  });
