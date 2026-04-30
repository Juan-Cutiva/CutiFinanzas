import { PiggyBank } from 'lucide-react';
import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/empty-state';
import { getOrCreateUser } from '@/db/queries/users';
import { listAccountsByUser } from '@/features/accounts/queries';
import { CreateSavingsGoalButton } from '@/features/savings/components/create-savings-button';
import { SavingsList } from '@/features/savings/components/savings-list';
import { listSavingsGoals } from '@/features/savings/queries';

export const metadata: Metadata = { title: 'Metas de ahorro' };
export const dynamic = 'force-dynamic';

export default async function AhorrosPage() {
  const user = await getOrCreateUser();
  const userId = user.id as never;
  const [goals, accounts] = await Promise.all([
    listSavingsGoals(userId),
    listAccountsByUser(userId),
  ]);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Metas de ahorro</h2>
          <p className="text-sm text-muted-foreground">
            Define objetivos y aporta cada mes para alcanzarlos.
          </p>
        </div>
        <CreateSavingsGoalButton defaultCurrency={user.defaultCurrency} />
      </header>

      {goals.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="¿Cuál es tu próxima meta?"
          description="Fondo de emergencia, viaje, computador nuevo… empieza por una y agrega más después."
        />
      ) : (
        <SavingsList
          items={goals}
          accounts={accounts.map((a) => ({ id: a.id, name: a.name, currency: a.currency }))}
        />
      )}
    </div>
  );
}
