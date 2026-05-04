import { TrendingDown } from 'lucide-react';
import type { Metadata } from 'next';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { getOrCreateUser } from '@/db/queries/users';
import { listCategoriesByUser } from '@/features/categories/queries';
import { TransactionList } from '@/features/transactions/components/transaction-list';
import { listExpenseByMonth } from '@/features/transactions/queries';
import { dayjs, formatAmount } from '@/lib/format';
import type { CurrencyCode } from '@/lib/money';

export const metadata: Metadata = { title: 'Gastos' };
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ y?: string; m?: string }>;
}

export default async function GastosPage({ searchParams }: PageProps) {
  const user = await getOrCreateUser();
  const userId = user.id as never;
  const currency = user.defaultCurrency as CurrencyCode;
  const params = await searchParams;
  const now = dayjs();
  const year = Number.parseInt(params.y ?? String(now.year()), 10);
  const month = Number.parseInt(params.m ?? String(now.month() + 1), 10);
  const monthLabel = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).format('MMMM YYYY');

  const [items, categories] = await Promise.all([
    listExpenseByMonth(userId, year, month),
    listCategoriesByUser(userId),
  ]);

  // Las compras con tarjeta de crédito (expense_* en cuenta credit_card/loan)
  // se muestran como referencia pero no entran en el balance: el gasto real
  // ocurre cuando se paga la tarjeta (credit_card_payment).
  function isCreditPurchase(t: (typeof items)[number]): boolean {
    return (
      (t.kind === 'expense_fixed' || t.kind === 'expense_variable') &&
      (t.account?.type === 'credit_card' || t.account?.type === 'loan')
    );
  }

  const counted = items.filter((t) => !isCreditPurchase(t));
  const recurring = counted.filter((t) => t.isRecurring || t.id.startsWith('virtual:'));
  const confirmedCount = recurring.filter((t) => t.isPaid).length;
  const recurringTotal = recurring.length;
  const fijosMinor = recurring.reduce((acc, t) => acc + Number(t.amountMinor), 0);
  const variablesMinor = counted
    .filter((t) => !t.isRecurring && !t.id.startsWith('virtual:'))
    .reduce((acc, t) => acc + Number(t.amountMinor), 0);
  const totalMinor = fijosMinor + variablesMinor;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Gastos</h2>
          <p className="text-sm text-muted-foreground">
            {monthLabel} — gastos fijos y variables del mes.
          </p>
        </div>
        {recurringTotal > 0 ? (
          <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Confirmados
            </p>
            <p className="font-mono tabular-nums text-sm font-semibold">
              {confirmedCount}/{recurringTotal}
            </p>
          </div>
        ) : null}
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Total" value={formatAmount(totalMinor / 100, currency)} />
        <SummaryCard label="Fijos" value={formatAmount(fijosMinor / 100, currency)} />
        <SummaryCard label="Variables" value={formatAmount(variablesMinor / 100, currency)} />
      </section>

      {items.length === 0 ? (
        <EmptyState
          icon={TrendingDown}
          title="Sin gastos este mes"
          description="Toca el botón ＋ para registrar un gasto (fijo o variable)."
        />
      ) : (
        <TransactionList items={items} categories={categories} />
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 font-mono tabular-nums text-xl font-semibold text-amount-negative">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
