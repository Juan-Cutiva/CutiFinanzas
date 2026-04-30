import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { savingsGoals } from '@/db/schema';
import type { UserId } from '@/types/ids';

export async function listSavingsGoals(userId: UserId) {
  return db
    .select()
    .from(savingsGoals)
    .where(and(eq(savingsGoals.userId, userId), eq(savingsGoals.status, 'active')))
    .orderBy(asc(savingsGoals.targetDate), asc(savingsGoals.name));
}
