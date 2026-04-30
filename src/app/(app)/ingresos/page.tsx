import { TrendingUp } from 'lucide-react';
import type { Metadata } from 'next';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { getOrCreateUser } from '@/db/queries/users';
import { TransactionList } from '@/features/transactions/components/transaction-list';
import { listIncomeByMonth, totalsByMonth } from '@/features/transactions/queries';
import { dayjs, formatAmount } from '@/lib/format';
import type { CurrencyCode } from '@/lib/money';

export const metadata: Metadata = { title: 'Ingresos' };
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ y?: string; m?: string }>;
}

export default async function IngresosPage({ searchParams }: PageProps) {
  const user = await getOrCreateUser();
  const userId = user.id as never;
  const currency = user.defaultCurrency as CurrencyCode;
  const params = await searchParams;
  const now = dayjs();
  const year = Number.parseInt(params.y ?? String(now.year()), 10);
  const month = Number.parseInt(params.m ?? String(now.month() + 1), 10);
  const monthLabel = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).format('MMMM YYYY');

  const [items, totals] = await Promise.all([
    listIncomeByMonth(userId, year, month),
    totalsByMonth(userId, year, month),
  ]);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Ingresos</h2>
        <p className="text-sm text-muted-foreground">
          {monthLabel} — salarios, rentas, extras y bonificaciones.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Total" value={formatAmount(totals.incomeMinor / 100, currency)} />
        <SummaryCard label="Fijos" value={formatAmount(totals.incomeFixedMinor / 100, currency)} />
        <SummaryCard
          label="Variables"
          value={formatAmount(totals.incomeVariableMinor / 100, currency)}
        />
      </section>

      {items.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="Sin ingresos este mes"
          description="Toca el botón ＋ para registrar un ingreso (fijo o variable)."
        />
      ) : (
        <TransactionList items={items} />
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 font-mono tabular-nums text-xl font-semibold text-amount-positive">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
