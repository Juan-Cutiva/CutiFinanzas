import { Wallet } from 'lucide-react';
import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/empty-state';
import { getOrCreateUser } from '@/db/queries/users';
import {
  AccountList,
  type AccountWithBalanceItem,
} from '@/features/accounts/components/account-list';
import { CreateAccountButton } from '@/features/accounts/components/create-account-button';
import type { AccountTypeCode } from '@/features/accounts/schema';
import { ensureRecurringMaterialized } from '@/features/transactions/materialize';
import { listAccountsWithBalances, monthRange } from '@/lib/accounting';
import { nowInTz } from '@/lib/format';
import type { UserId } from '@/types/ids';

export const metadata: Metadata = { title: 'Cuentas' };
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ y?: string; m?: string }>;
}

export default async function CuentasPage({ searchParams }: PageProps) {
  const user = await getOrCreateUser();
  const userId = user.id as UserId;
  // Self-healing: materializa recurrentes vencidas al cargar (no depende del cron).
  await ensureRecurringMaterialized(userId, user.timezone);
  const params = await searchParams;
  const now = nowInTz(user.timezone);
  const year = Number.parseInt(params.y ?? String(now.year()), 10);
  const month = Number.parseInt(params.m ?? String(now.month() + 1), 10);
  const today = now.format('YYYY-MM-DD');
  const { to } = monthRange(year, month);

  const list = await listAccountsWithBalances(userId, to, today);
  const accounts: AccountWithBalanceItem[] = list.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type as AccountTypeCode,
    currency: a.currency,
    institution: a.institution,
    realMinor: a.realMinor,
    projectedMinor: a.projectedMinor,
    creditLimitMinor: a.creditLimitMinor,
  }));

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Cuentas</h2>
          <p className="text-sm text-muted-foreground">
            Tus billeteras: efectivo, débito, ahorros y tarjetas de crédito.
          </p>
        </div>
        <CreateAccountButton defaultCurrency={user.defaultCurrency} />
      </header>

      {accounts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Crea tu primera cuenta"
          description="Vas a poder asignar cada movimiento a una cuenta y ver saldos en tiempo real."
        />
      ) : (
        <AccountList accounts={accounts} />
      )}
    </div>
  );
}
