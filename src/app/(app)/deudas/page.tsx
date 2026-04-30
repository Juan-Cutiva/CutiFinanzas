import { CreditCard } from 'lucide-react';
import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/empty-state';
import { getOrCreateUser } from '@/db/queries/users';
import { CreateDebtButton } from '@/features/debts/components/create-debt-button';
import { DebtList } from '@/features/debts/components/debt-list';
import { listDebtsByUser } from '@/features/debts/queries';

export const metadata: Metadata = { title: 'Deudas' };
export const dynamic = 'force-dynamic';

export default async function DeudasPage() {
  const user = await getOrCreateUser();
  const debts = await listDebtsByUser(user.id as never);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Deudas</h2>
          <p className="text-sm text-muted-foreground">
            Cuotas, intereses y plazos restantes con cálculo automático.
          </p>
        </div>
        <CreateDebtButton defaultCurrency={user.defaultCurrency} />
      </header>

      {debts.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="Sin deudas registradas"
          description="¡Excelente! Si más adelante adquieres una, podrás registrarla aquí."
        />
      ) : (
        <DebtList items={debts} />
      )}
    </div>
  );
}
