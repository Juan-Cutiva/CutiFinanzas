import dayjs from 'dayjs';
import { getOrCreateUser } from '@/db/queries/users';
import { listAccountsByUser } from '@/features/accounts/queries';
import { listCategoriesByUser } from '@/features/categories/queries';
import { listSavingsGoalsRaw } from '@/features/savings/queries';
import { QuickAddDrawer } from '@/features/transactions/components/quick-add-drawer';
import {
  getProjectedBalanceMinor,
  listAccountsWithBalances,
  listDebtsWithState,
  monthRange,
} from '@/lib/accounting';
import { nowInTz } from '@/lib/format';
import type { UserId } from '@/types/ids';

const FUTURE_MONTHS = 12;

export async function QuickAddFAB() {
  const user = await getOrCreateUser();
  const userId = user.id as UserId;
  const now = nowInTz(user.timezone);
  const today = now.format('YYYY-MM-DD');
  const { to: endOfMonth } = monthRange(now.year(), now.month() + 1);

  // Saldo real hoy + proyectado fin de mes actual (para vista por defecto).
  const [accountsRaw, categories, accountsState, debtsState, savings] = await Promise.all([
    listAccountsByUser(userId),
    listCategoriesByUser(userId),
    listAccountsWithBalances(userId, endOfMonth, today),
    listDebtsWithState(userId, today, today),
    listSavingsGoalsRaw(userId),
  ]);

  const stateById = new Map(accountsState.map((a) => [a.id, a]));

  // Proyección por cuenta y por mes futuro (para que el form muestre el saldo
  // proyectado al fin del mes de la fecha que el usuario seleccione).
  // Mapa: `${accountId}:${YYYY-MM}` → projectedMinor en string.
  const projectedByMonth: Record<string, string> = {};
  for (const a of accountsRaw) {
    for (let i = 0; i < FUTURE_MONTHS; i++) {
      const target = now.add(i, 'month');
      const { to } = monthRange(target.year(), target.month() + 1);
      const ym = target.format('YYYY-MM');
      const result = await getProjectedBalanceMinor(userId, a.id, to, today);
      projectedByMonth[`${a.id}:${ym}`] = result.projectedMinor.toString();
    }
  }

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
      projectedByMonth={projectedByMonth}
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
