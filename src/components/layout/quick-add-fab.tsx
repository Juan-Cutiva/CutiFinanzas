import { getOrCreateUser } from '@/db/queries/users';
import { listAccountsByUser } from '@/features/accounts/queries';
import { listCategoriesByUser } from '@/features/categories/queries';
import { listDebtsByUser } from '@/features/debts/queries';
import { listSavingsGoals } from '@/features/savings/queries';
import { QuickAddDrawer } from '@/features/transactions/components/quick-add-drawer';

export async function QuickAddFAB() {
  const user = await getOrCreateUser();
  const userId = user.id as never;
  const [accounts, categories, debts, savingsGoals] = await Promise.all([
    listAccountsByUser(userId),
    listCategoriesByUser(userId),
    listDebtsByUser(userId),
    listSavingsGoals(userId),
  ]);

  return (
    <QuickAddDrawer
      accounts={accounts.map((a) => ({
        id: a.id,
        name: a.name,
        currency: a.currency,
        type: a.type,
      }))}
      categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      debts={debts.map((d) => ({ id: d.id, name: d.name, currency: d.currency }))}
      savingsGoals={savingsGoals.map((g) => ({
        id: g.id,
        name: g.name,
        currency: g.currency,
      }))}
      defaultCurrency={user.defaultCurrency}
    />
  );
}
