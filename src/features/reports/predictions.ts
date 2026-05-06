import 'server-only';
import dayjs from 'dayjs';
import { and, between, eq, inArray, isNotNull, sum } from 'drizzle-orm';
import { db } from '@/db/client';
import { recurringRules, transactions } from '@/db/schema';
import { EXPENSE_KINDS, type TransactionKind } from '@/lib/accounting';
import {
  generateVirtualOccurrences,
  type RecurringRuleForVirtuals,
} from '@/lib/accounting/virtuals';
import type { UserId } from '@/types/ids';

export interface CategoryInsight {
  categoryId: string | null;
  categoryName: string;
  currentMinor: number;
  averageMinor: number;
  pctChange: number;
  status: 'over' | 'on_track' | 'under';
}

/**
 * Compara el gasto del mes actual por categoría con el promedio de los últimos
 * `monthsBack` meses.
 *
 * Si `today` se provee y el mes seleccionado se extiende más allá de hoy
 * (estamos viendo el mes en curso o un mes futuro), las ocurrencias virtuales
 * pendientes de materializar se agregan al "actual" para que la tendencia
 * refleje el escenario completo del mes (ya gastado + programado).
 */
export async function categoryInsights(
  userId: UserId,
  year: number,
  month: number,
  monthsBack = 3,
  today?: string,
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

  // Acumula el "actual" en un Map para poder agregar virtuales sin duplicar.
  const currentMap = new Map<string | null, number>();
  for (const r of currentRows) currentMap.set(r.categoryId, r.total ?? 0);

  // Si el mes seleccionado se extiende a futuro respecto a today, agrega virtuales
  // (excluyendo las que ya fueron materializadas) a la suma actual por categoría.
  if (today && currentTo > today) {
    const expenseKinds = new Set<TransactionKind>(EXPENSE_KINDS as TransactionKind[]);
    const [rules, materialized] = await Promise.all([
      db
        .select()
        .from(recurringRules)
        .where(and(eq(recurringRules.userId, userId), eq(recurringRules.isActive, true))),
      db
        .select({
          ruleId: transactions.recurringRuleId,
          date: transactions.transactionDate,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            between(transactions.transactionDate, currentFrom, currentTo),
            isNotNull(transactions.recurringRuleId),
          ),
        ),
    ]);
    const matSet = new Set<string>();
    for (const m of materialized) {
      if (m.ruleId) matSet.add(`${m.ruleId}:${m.date}`);
    }
    for (const r of rules) {
      const rule = ruleToVirtual(r);
      const occs = generateVirtualOccurrences(rule, currentTo, currentFrom);
      for (const v of occs) {
        if (matSet.has(`${r.id}:${v.transactionDate}`)) continue;
        if (!expenseKinds.has(v.kind)) continue;
        const prev = currentMap.get(v.categoryId) ?? 0;
        currentMap.set(v.categoryId, prev + Number(v.amountMinor));
      }
    }
  }

  const baselineMap = new Map<string, number>();
  for (const r of baselineRows) baselineMap.set(r.categoryId ?? '__none__', r.total ?? 0);

  const categoryNames = await db.query.categories.findMany({
    where: (c, { eq }) => eq(c.userId, userId),
  });
  const nameMap = new Map(categoryNames.map((c) => [c.id, c.name]));

  return Array.from(currentMap.entries()).map(([categoryId, total]) => {
    const key = categoryId ?? '__none__';
    const baselineTotal = baselineMap.get(key) ?? 0;
    const baselineAvg = baselineTotal / monthsBack;
    const pctChange = baselineAvg > 0 ? ((total - baselineAvg) / baselineAvg) * 100 : 0;
    const status: CategoryInsight['status'] =
      pctChange > 15 ? 'over' : pctChange < -15 ? 'under' : 'on_track';
    return {
      categoryId,
      categoryName: categoryId ? (nameMap.get(categoryId) ?? 'Categoría') : 'Sin categoría',
      currentMinor: total,
      averageMinor: baselineAvg,
      pctChange,
      status,
    };
  });
}

function ruleToVirtual(r: typeof recurringRules.$inferSelect): RecurringRuleForVirtuals {
  return {
    id: r.id,
    kind: r.kind,
    amountMinor: BigInt(r.amountMinor as unknown as string | number | bigint),
    currency: r.currency,
    frequency: r.frequency as RecurringRuleForVirtuals['frequency'],
    dayOfMonth: r.dayOfMonth,
    dayOfWeek: r.dayOfWeek,
    startDate: r.startDate,
    endDate: r.endDate,
    nextOccurrenceDate: r.nextOccurrenceDate,
    accountId: r.accountId,
    counterAccountId: r.counterAccountId,
    categoryId: r.categoryId,
    debtId: r.debtId,
    savingsGoalId: r.savingsGoalId,
    isActive: r.isActive,
  };
}
