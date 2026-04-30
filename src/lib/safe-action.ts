import 'server-only';
import { auth } from '@clerk/nextjs/server';
import { createSafeActionClient, DEFAULT_SERVER_ERROR_MESSAGE } from 'next-safe-action';
import { z } from 'zod';
import type { UserId } from '@/types/ids';
import { AppError, UnauthorizedError } from './errors';

export const actionClient = createSafeActionClient({
  defineMetadataSchema() {
    return z.object({
      actionName: z.string(),
    });
  },
  handleServerError(error) {
    if (error instanceof AppError) {
      return error.message;
    }

    if (process.env.NODE_ENV === 'development') {
      console.error('[ServerAction]', error);
    }

    return DEFAULT_SERVER_ERROR_MESSAGE;
  },
});

export const authedAction = actionClient.use(async ({ next }) => {
  const { userId } = await auth();
  if (!userId) throw new UnauthorizedError();
  return next({ ctx: { userId: userId as UserId } });
});
