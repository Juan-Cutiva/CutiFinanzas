import 'server-only';
import { and, asc, eq, ne } from 'drizzle-orm';
import { db } from '@/db/client';
import { debts } from '@/db/schema';
import { type DebtState, getDebtState, listDebtsWithState } from '@/lib/accounting';
import type { UserId } from '@/types/ids';

export async function listDebtsRaw(userId: UserId) {
  return db
    .select()
    .from(debts)
    .where(and(eq(debts.userId, userId), ne(debts.status, 'paid_off')))
    .orderBy(asc(debts.endDate), asc(debts.name));
}

export async function listAllDebts(userId: UserId) {
  return db
    .select()
    .from(debts)
    .where(eq(debts.userId, userId))
    .orderBy(asc(debts.endDate), asc(debts.name));
}

export async function getDebtRaw(userId: UserId, id: string) {
  return db.query.debts.findFirst({
    where: and(eq(debts.userId, userId), eq(debts.id, id)),
  });
}

export async function listDebtsForDashboard(
  userId: UserId,
  asOfDate: string,
  today: string,
): Promise<DebtState[]> {
  return listDebtsWithState(userId, asOfDate, today);
}

export async function getDebtForDetail(
  userId: UserId,
  id: string,
  asOfDate: string,
  today: string,
): Promise<DebtState | null> {
  return getDebtState(userId, id, asOfDate, today);
}
