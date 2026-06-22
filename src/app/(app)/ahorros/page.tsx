import { PiggyBank } from 'lucide-react';
import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/empty-state';
import { getOrCreateUser } from '@/db/queries/users';
import { CreateSavingsGoalButton } from '@/features/savings/components/create-savings-button';
import { type SavingsGoalItem, SavingsList } from '@/features/savings/components/savings-list';
import { listSavingsGoalsForDashboard } from '@/features/savings/queries';
import { ensureRecurringMaterialized } from '@/features/transactions/materialize';
import { monthRange } from '@/lib/accounting';
import { nowInTz } from '@/lib/format';
import type { UserId } from '@/types/ids';

export const metadata: Metadata = { title: 'Metas de ahorro' };
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ y?: string; m?: string }>;
}

export default async function AhorrosPage({ searchParams }: PageProps) {
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

  const goals = await listSavingsGoalsForDashboard(userId, today, to);
  const items: SavingsGoalItem[] = goals.map((g) => ({
    id: g.id,
    name: g.name,
    targetAmountMinor: g.targetAmountMinor,
    currentAmountMinor: g.currentAmountMinor,
    projectedAmountMinor: g.projectedAmountMinor,
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
