import 'server-only';
import { currentUser } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { type UserRow, users } from '@/db/schema';
import { DEFAULT_CURRENCY, DEFAULT_LOCALE, DEFAULT_TIMEZONE } from '@/lib/constants';
import { UnauthorizedError } from '@/lib/errors';
import type { UserId } from '@/types/ids';

export async function getOrCreateUser(): Promise<UserRow> {
  const clerkUser = await currentUser();
  if (!clerkUser) throw new UnauthorizedError();

  const existing = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkUser.id),
  });
  if (existing) return existing;

  const email =
    clerkUser.primaryEmailAddress?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) {
    throw new Error('El usuario de Clerk no tiene email principal');
  }

  const fullName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || null;

  const [created] = await db
    .insert(users)
    .values({
      id: clerkUser.id,
      clerkId: clerkUser.id,
      email,
      name: fullName,
      imageUrl: clerkUser.imageUrl ?? null,
      defaultCurrency: DEFAULT_CURRENCY,
      locale: DEFAULT_LOCALE,
      timezone: DEFAULT_TIMEZONE,
    })
    .onConflictDoUpdate({
      target: users.clerkId,
      set: { email, name: fullName, imageUrl: clerkUser.imageUrl ?? null },
    })
    .returning();

  if (!created) throw new Error('No se pudo crear el usuario');
  return created;
}

export async function getUserId(): Promise<UserId> {
  const user = await getOrCreateUser();
  return user.id as UserId;
}
