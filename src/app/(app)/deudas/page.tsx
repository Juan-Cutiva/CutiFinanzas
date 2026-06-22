import { CreditCard } from 'lucide-react';
import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/empty-state';
import { getOrCreateUser } from '@/db/queries/users';
import { CreateDebtButton } from '@/features/debts/components/create-debt-button';
import { type DebtItem, DebtList } from '@/features/debts/components/debt-list';
import { listDebtsForDashboard } from '@/features/debts/queries';
import { ensureRecurringMaterialized } from '@/features/transactions/materialize';
import { monthRange } from '@/lib/accounting';
import { formatMonthYear, nowInTz } from '@/lib/format';
import type { UserId } from '@/types/ids';

export const metadata: Metadata = { title: 'Préstamos' };
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ y?: string; m?: string }>;
}

export default async function DeudasPage({ searchParams }: PageProps) {
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
  const monthLabel = formatMonthYear(`${year}-${String(month).padStart(2, '0')}-01`);

  const debtsState = await listDebtsForDashboard(userId, to, today);
  const items: DebtItem[] = debtsState.map((d) => ({
    id: d.id,
    name: d.name,
    principalMinor: d.principalMinor,
    realBalanceMinor: d.realBalanceMinor,
    projectedBalanceMinor: d.projectedBalanceMinor,
    currency: d.currency,
    monthlyPaymentMinor: d.monthlyPaymentMinor,
    interestRateAnnual: d.interestRateAnnual,
  }));

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Préstamos</h2>
          <p className="text-sm text-muted-foreground">
            Saldo proyectado al cierre de {monthLabel}.
          </p>
        </div>
        <CreateDebtButton defaultCurrency={user.defaultCurrency} />
      </header>

      {items.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="Sin préstamos registrados"
          description="¡Excelente! Si más adelante adquieres uno, podrás registrarlo aquí."
        />
      ) : (
        <DebtList items={items} />
      )}
    </div>
  );
}
