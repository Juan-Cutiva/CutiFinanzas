import dayjs from 'dayjs';
import { getOrCreateUser } from '@/db/queries/users';
import { listAccountsByUser } from '@/features/accounts/queries';
import { listCategoriesByUser } from '@/features/categories/queries';
import { listSavingsGoalsRaw } from '@/features/savings/queries';
import { QuickAddDrawer } from '@/features/transactions/components/quick-add-drawer';
import { listAccountsWithBalances, listDebtsWithState, monthRange } from '@/lib/accounting';
import { nowInTz } from '@/lib/format';
import type { UserId } from '@/types/ids';

export async function QuickAddFAB() {
  const user = await getOrCreateUser();
  const userId = user.id as UserId;
  const now = nowInTz(user.timezone);
  const today = now.format('YYYY-MM-DD');
  const { to: endOfMonth } = monthRange(now.year(), now.month() + 1);

  // Saldo real hoy + proyectado fin de mes (incluyendo recurrentes pendientes).
  const [accountsRaw, categories, accountsState, debtsState, savings] = await Promise.all([
    listAccountsByUser(userId),
    listCategoriesByUser(userId),
    listAccountsWithBalances(userId, endOfMonth, today),
    listDebtsWithState(userId, today, today),
    listSavingsGoalsRaw(userId),
  ]);

  const stateById = new Map(accountsState.map((a) => [a.id, a]));

  return (
    <QuickAddDrawer
      accounts={accountsRaw.map((a) => {
        const st = stateById.get(a.id);
        return {
          id: a.id,
          name: a.name,
          currency: a.currency,
          type: a.type,
          realMinor: (st?.realMinor ?? 0n).toString(),
          projectedMinor: (st?.projectedMinor ?? 0n).toString(),
          creditLimitMinor: a.creditLimitMinor ? String(a.creditLimitMinor) : null,
        };
      })}
      categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      debts={debtsState.map((d) => ({
        id: d.id,
        name: d.name,
        currency: d.currency,
        realBalanceMinor: d.realBalanceMinor.toString(),
      }))}
      savingsGoals={savings.map((g) => ({ id: g.id, name: g.name, currency: g.currency }))}
      defaultCurrency={user.defaultCurrency}
      defaultDate={dayjs(today).format('YYYY-MM-DD')}
    />
  );
}
