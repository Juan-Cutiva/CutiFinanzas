import 'server-only';
import { and, asc, eq, ne } from 'drizzle-orm';
import { db } from '@/db/client';
import { debts } from '@/db/schema';
import type { UserId } from '@/types/ids';

export async function listDebtsByUser(userId: UserId) {
  return db
    .select()
    .from(debts)
    .where(and(eq(debts.userId, userId), ne(debts.status, 'paid_off')))
    .orderBy(asc(debts.endDate), asc(debts.name));
}

export async function getDebtById(userId: UserId, id: string) {
  return db.query.debts.findFirst({ where: and(eq(debts.userId, userId), eq(debts.id, id)) });
}
