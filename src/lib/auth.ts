import 'server-only';
import { auth, currentUser } from '@clerk/nextjs/server';
import type { UserId } from '@/types/ids';
import { UnauthorizedError } from './errors';

export async function requireUserId(): Promise<UserId> {
  const { userId } = await auth();
  if (!userId) throw new UnauthorizedError();
  return userId as UserId;
}

export async function getOptionalUserId(): Promise<UserId | null> {
  const { userId } = await auth();
  return (userId ?? null) as UserId | null;
}

export async function requireCurrentUser() {
  const user = await currentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}
