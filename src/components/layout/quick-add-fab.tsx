import { getOrCreateUser } from '@/db/queries/users';
import { listAccountsByUser } from '@/features/accounts/queries';
import { listCategoriesByUser } from '@/features/categories/queries';
import { QuickAddDrawer } from '@/features/transactions/components/quick-add-drawer';

export async function QuickAddFAB() {
  const user = await getOrCreateUser();
  const userId = user.id as never;
  const [accounts, categories] = await Promise.all([
    listAccountsByUser(userId),
    listCategoriesByUser(userId),
  ]);

  return (
    <QuickAddDrawer
      accounts={accounts.map((a) => ({ id: a.id, name: a.name, currency: a.currency }))}
      categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      defaultCurrency={user.defaultCurrency}
    />
  );
}
