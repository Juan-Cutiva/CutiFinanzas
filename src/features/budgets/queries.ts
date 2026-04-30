import 'server-only';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { budgets } from '@/db/schema';
import type { UserId } from '@/types/ids';

export async function listBudgetsByMonth(userId: UserId, year: number, month: number) {
  return db.query.budgets.findMany({
    where: and(eq(budgets.userId, userId), eq(budgets.year, year), eq(budgets.month, month)),
    with: { category: true },
  });
}
