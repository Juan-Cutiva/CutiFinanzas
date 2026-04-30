import { Wallet } from 'lucide-react';
import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/empty-state';
import { getOrCreateUser } from '@/db/queries/users';
import { AccountList } from '@/features/accounts/components/account-list';
import { CreateAccountButton } from '@/features/accounts/components/create-account-button';
import { listAccountsWithBalance } from '@/features/accounts/queries';

export const metadata: Metadata = { title: 'Cuentas' };
export const dynamic = 'force-dynamic';

export default async function CuentasPage() {
  const user = await getOrCreateUser();
  const accounts = await listAccountsWithBalance(user.id as never);

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
