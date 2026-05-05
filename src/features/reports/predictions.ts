import 'server-only';
import dayjs from 'dayjs';
import { and, between, eq, inArray, sum } from 'drizzle-orm';
import { db } from '@/db/client';
import { transactions } from '@/db/schema';
import { EXPENSE_KINDS, type TransactionKind } from '@/lib/accounting';
import type { UserId } from '@/types/ids';

export interface CategoryInsight {
  categoryId: string | null;
  categoryName: string;
  currentMinor: number;
  averageMinor: number;
  pctChange: number;
  status: 'over' | 'on_track' | 'under';
}

export async function categoryInsights(
  userId: UserId,
  year: number,
  month: number,
  monthsBack = 3,
): Promise<CategoryInsight[]> {
  const monthStart = dayjs(`${year}-${String(month).padStart(2, '0')}-01`);
  const currentFrom = monthStart.format('YYYY-MM-DD');
  const currentTo = monthStart.endOf('month').format('YYYY-MM-DD');
  const baselineFrom = monthStart.subtract(monthsBack, 'month').format('YYYY-MM-DD');
  const baselineTo = monthStart.subtract(1, 'day').format('YYYY-MM-DD');

  const [currentRows, baselineRows] = await Promise.all([
    db
      .select({
        categoryId: transactions.categoryId,
        total: sum(transactions.amountMinor).mapWith(Number),
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          inArray(transactions.kind, EXPENSE_KINDS as TransactionKind[]),
          between(transactions.transactionDate, currentFrom, currentTo),
        ),
      )
      .groupBy(transactions.categoryId),
    db
      .select({
        categoryId: transactions.categoryId,
        total: sum(transactions.amountMinor).mapWith(Number),
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          inArray(transactions.kind, EXPENSE_KINDS as TransactionKind[]),
          between(transactions.transactionDate, baselineFrom, baselineTo),
        ),
      )
      .groupBy(transactions.categoryId),
  ]);

  const baselineMap = new Map<string, number>();
  for (const r of baselineRows) baselineMap.set(r.categoryId ?? '__none__', r.total ?? 0);

  const categoryNames = await db.query.categories.findMany({
    where: (c, { eq }) => eq(c.userId, userId),
  });
  const nameMap = new Map(categoryNames.map((c) => [c.id, c.name]));

  return currentRows.map((r) => {
    const key = r.categoryId ?? '__none__';
    const total = r.total ?? 0;
    const baselineTotal = baselineMap.get(key) ?? 0;
    const baselineAvg = baselineTotal / monthsBack;
    const pctChange = baselineAvg > 0 ? ((total - baselineAvg) / baselineAvg) * 100 : 0;
    const status: CategoryInsight['status'] =
      pctChange > 15 ? 'over' : pctChange < -15 ? 'under' : 'on_track';
    return {
      categoryId: r.categoryId,
      categoryName: r.categoryId ? (nameMap.get(r.categoryId) ?? 'Categoría') : 'Sin categoría',
      currentMinor: total,
      averageMinor: baselineAvg,
      pctChange,
      status,
    };
  });
}
