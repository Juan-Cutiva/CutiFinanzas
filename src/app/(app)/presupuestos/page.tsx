import { Target } from 'lucide-react';
import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/empty-state';
import { getOrCreateUser } from '@/db/queries/users';
import { BudgetList, type BudgetWithSpent } from '@/features/budgets/components/budget-list';
import { CreateBudgetButton } from '@/features/budgets/components/create-budget-button';
import { listBudgetsByMonth } from '@/features/budgets/queries';
import { listCategoriesByUser } from '@/features/categories/queries';
import { ensureRecurringMaterialized } from '@/features/transactions/materialize';
import { getCategoryExpenseTotals, monthRange } from '@/lib/accounting';
import { formatMonthYear, nowInTz } from '@/lib/format';
import type { UserId } from '@/types/ids';

export const metadata: Metadata = { title: 'Presupuestos' };
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ y?: string; m?: string }>;
}

export default async function PresupuestosPage({ searchParams }: PageProps) {
  const user = await getOrCreateUser();
  const userId = user.id as UserId;
  // Self-healing: materializa recurrentes vencidas al cargar (no depende del cron).
  await ensureRecurringMaterialized(userId, user.timezone);
  const params = await searchParams;
  const now = nowInTz(user.timezone);
  const year = Number.parseInt(params.y ?? String(now.year()), 10);
  const month = Number.parseInt(params.m ?? String(now.month() + 1), 10);
  const monthLabel = formatMonthYear(`${year}-${String(month).padStart(2, '0')}-01`);

  const { from, to } = monthRange(year, month);
  const [budgets, categories, byCategory] = await Promise.all([
    listBudgetsByMonth(userId, year, month),
    listCategoriesByUser(userId),
    getCategoryExpenseTotals(userId, from, to),
  ]);

  const items: BudgetWithSpent[] = budgets.map((b) => ({
    id: b.id,
    amountMinor: b.amountMinor as bigint,
    currency: b.currency,
    spentMinor: Number(byCategory.find((s) => s.categoryId === b.categoryId)?.totalMinor ?? 0n),
    year: b.year,
    month: b.month,
    notes: b.notes,
    isVirtual: b.isVirtual,
    category: { name: b.category.name, color: b.category.color },
  }));

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Presupuestos</h2>
          <p className="text-sm text-muted-foreground">
            {monthLabel} — define cuánto puedes gastar por categoría.
          </p>
        </div>
        <CreateBudgetButton
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          year={year}
          month={month}
          defaultCurrency={user.defaultCurrency}
        />
      </header>

      {items.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Sin presupuestos este mes"
          description="Crea tu primer presupuesto para una categoría y mide cuánto te falta o sobra."
        />
      ) : (
        <BudgetList items={items} />
      )}
    </div>
  );
}
