import { BarChart3, Download } from 'lucide-react';
import type { Metadata } from 'next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { getOrCreateUser } from '@/db/queries/users';
import { listCategoriesByUser } from '@/features/categories/queries';
import { CategoryChart } from '@/features/reports/components/category-chart';
import { totalsByCategoryByMonth, totalsByMonth } from '@/features/transactions/queries';
import { dayjs, formatAmount } from '@/lib/format';
import type { CurrencyCode } from '@/lib/money';

export const metadata: Metadata = { title: 'Reportes' };
export const dynamic = 'force-dynamic';

export default async function ReportesPage() {
  const user = await getOrCreateUser();
  const userId = user.id as never;
  const currency = user.defaultCurrency as CurrencyCode;
  const now = dayjs();
  const year = now.year();
  const month = now.month() + 1;

  const [totals, categories, byCategory] = await Promise.all([
    totalsByMonth(userId, year, month),
    listCategoriesByUser(userId),
    totalsByCategoryByMonth(userId, year, month),
  ]);

  const totalIncome = totals.incomeMinor / 100;
  const totalExpense =
    (totals.expenseFixedMinor +
      totals.expenseVariableMinor +
      totals.debtPaymentMinor +
      totals.savingsContributionMinor) /
    100;
  const balance = totalIncome - totalExpense;

  const chartData = categories
    .map((c) => ({
      name: c.name,
      value: (byCategory.find((b) => b.categoryId === c.id)?.total ?? 0) / 100,
      color: c.color,
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  const hasData = chartData.length > 0;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Reportes</h2>
          <p className="text-sm text-muted-foreground">
            {now.format('MMMM YYYY')} — análisis del mes y exportación a PDF.
          </p>
        </div>
        <Button asChild>
          <a
            href={`/api/reports/monthly?year=${year}&month=${month}`}
            target="_blank"
            rel="noreferrer"
          >
            <Download className="size-4" aria-hidden />
            Descargar PDF
          </a>
        </Button>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Ingresos" value={formatAmount(totalIncome, currency)} tone="positive" />
        <SummaryCard label="Gastos" value={formatAmount(totalExpense, currency)} tone="negative" />
        <SummaryCard
          label="Balance"
          value={formatAmount(balance, currency)}
          tone={balance >= 0 ? 'positive' : 'negative'}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Gastos por categoría</CardTitle>
          <CardDescription>Distribución de gastos del mes en curso.</CardDescription>
        </CardHeader>
        <CardContent>
          {hasData ? (
            <CategoryChart data={chartData} currency={currency} />
          ) : (
            <EmptyState
              icon={BarChart3}
              title="Aún no hay datos"
              description="Cuando registres gastos, aparecerán graficados por categoría aquí."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'positive' | 'negative';
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p
          className={`mt-1 font-mono tabular-nums text-xl font-semibold ${
            tone === 'positive' ? 'text-amount-positive' : 'text-amount-negative'
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
