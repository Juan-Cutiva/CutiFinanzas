import { PiggyBank } from 'lucide-react';
import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/empty-state';
import { getOrCreateUser } from '@/db/queries/users';
import { CreateSavingsGoalButton } from '@/features/savings/components/create-savings-button';
import { type SavingsGoalItem, SavingsList } from '@/features/savings/components/savings-list';
import { listSavingsGoalsForDashboard } from '@/features/savings/queries';
import { nowInTz } from '@/lib/format';
import type { UserId } from '@/types/ids';

export const metadata: Metadata = { title: 'Metas de ahorro' };
export const dynamic = 'force-dynamic';

export default async function AhorrosPage() {
  const user = await getOrCreateUser();
  const userId = user.id as UserId;
  const today = nowInTz(user.timezone).format('YYYY-MM-DD');

  const goals = await listSavingsGoalsForDashboard(userId, today);
  const items: SavingsGoalItem[] = goals.map((g) => ({
    id: g.id,
    name: g.name,
    targetAmountMinor: g.targetAmountMinor,
    currentAmountMinor: g.currentAmountMinor,
    monthlyContributionMinor: g.monthlyContributionMinor,
    currency: g.currency,
    color: g.color,
    targetDate: g.targetDate,
  }));

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Metas de ahorro</h2>
          <p className="text-sm text-muted-foreground">
            Define objetivos. Aporta con movimientos tipo "Aporte a meta de ahorro".
          </p>
        </div>
        <CreateSavingsGoalButton defaultCurrency={user.defaultCurrency} />
      </header>

      {items.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="¿Cuál es tu próxima meta?"
          description="Fondo de emergencia, viaje, computador nuevo… empieza por una y agrega más después."
        />
      ) : (
        <SavingsList items={items} />
      )}
    </div>
  );
}
