import { Target } from 'lucide-react';
import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/empty-state';
import { getOrCreateUser } from '@/db/queries/users';
import { BudgetList } from '@/features/budgets/components/budget-list';
import { CreateBudgetButton } from '@/features/budgets/components/create-budget-button';
import { listBudgetsByMonth } from '@/features/budgets/queries';
import { listCategoriesByUser } from '@/features/categories/queries';
import { totalsByCategoryByMonth } from '@/features/transactions/queries';
import { dayjs } from '@/lib/format';

export const metadata: Metadata = { title: 'Presupuestos' };
export const dynamic = 'force-dynamic';

export default async function PresupuestosPage() {
  const user = await getOrCreateUser();
  const userId = user.id as never;
  const now = dayjs();
  const year = now.year();
  const month = now.month() + 1;

  const [budgets, categories, spentByCategory] = await Promise.all([
    listBudgetsByMonth(userId, year, month),
    listCategoriesByUser(userId),
    totalsByCategoryByMonth(userId, year, month),
  ]);

  const items = budgets.map((b) => ({
    id: b.id,
    amountMinor: b.amountMinor,
    currency: b.currency,
    spentMinor: spentByCategory.find((s) => s.categoryId === b.categoryId)?.total ?? 0,
    category: { name: b.category.name, color: b.category.color },
  }));

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Presupuestos</h2>
          <p className="text-sm text-muted-foreground">
            {now.format('MMMM YYYY')} — define cuánto puedes gastar por categoría.
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
