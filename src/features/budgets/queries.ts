import 'server-only';
import { and, eq, lte, or, sql } from 'drizzle-orm';
import { cache } from 'react';
import { db } from '@/db/client';
import { budgets, categories } from '@/db/schema';
import type { UserId } from '@/types/ids';

type BudgetMonthRow = typeof budgets.$inferSelect & {
  category: { id: string; name: string; color: string; icon: string };
  isVirtual: boolean;
};

/**
 * Devuelve los presupuestos visibles para un mes:
 * 1. Filas explícitas de (year, month) — overrides puntuales o reglas creadas
 *    en ese mes mismo.
 * 2. Para cada categoría sin override en ese mes, busca la regla recurrente
 *    (is_recurring = true) más reciente con (year, month) ≤ (target) y la
 *    expone como virtual.
 */
export const listBudgetsByMonth = cache(async function listBudgetsByMonth(
  userId: UserId,
  year: number,
  month: number,
): Promise<BudgetMonthRow[]> {
  const explicit = await db.query.budgets.findMany({
    where: and(eq(budgets.userId, userId), eq(budgets.year, year), eq(budgets.month, month)),
    with: { category: true },
  });

  const explicitCategoryIds = new Set(explicit.map((b) => b.categoryId));

  const targetOrdinal = year * 12 + (month - 1);
  const ruleCandidates = await db.query.budgets.findMany({
    where: and(
      eq(budgets.userId, userId),
      eq(budgets.isRecurring, true),
      or(sql`${budgets.year} < ${year}`, and(eq(budgets.year, year), lte(budgets.month, month))),
    ),
    with: { category: true },
    orderBy: (b, { desc }) => [desc(b.year), desc(b.month)],
  });

  const seen = new Set<string>();
  const virtualRows: BudgetMonthRow[] = [];
  for (const r of ruleCandidates) {
    if (explicitCategoryIds.has(r.categoryId)) continue;
    const key = `${r.categoryId}:${r.period}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const ruleOrdinal = r.year * 12 + (r.month - 1);
    if (ruleOrdinal > targetOrdinal) continue;

    virtualRows.push({
      ...r,
      year,
      month,
      isVirtual: true,
      id: `virtual:${r.id}:${year}-${String(month).padStart(2, '0')}`,
    });
  }

  const explicitWithFlag: BudgetMonthRow[] = explicit.map((b) => ({ ...b, isVirtual: false }));
  return [...explicitWithFlag, ...virtualRows].sort((a, b) =>
    a.category.name.localeCompare(b.category.name, 'es'),
  );
});

export async function getBudgetById(userId: UserId, id: string) {
  return db.query.budgets.findFirst({
    where: and(eq(budgets.userId, userId), eq(budgets.id, id)),
    with: { category: true },
  });
}

export { categories };
