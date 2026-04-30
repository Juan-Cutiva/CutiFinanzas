import { BarChart3, Calendar, Download } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { getOrCreateUser } from '@/db/queries/users';
import { listCategoriesByUser } from '@/features/categories/queries';
import { CategoryChart } from '@/features/reports/components/category-chart';
import { CategoryInsights } from '@/features/reports/components/category-insights';
import { ExpenseHeatmap } from '@/features/reports/components/expense-heatmap';
import { SankeyFlow } from '@/features/reports/components/sankey-flow';
import { categoryInsights } from '@/features/reports/predictions';
import {
  dailyTotalsForMonth,
  totalsByCategoryByMonth,
  totalsByMonth,
} from '@/features/transactions/queries';
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

  const [totals, categories, byCategory, daily, insights] = await Promise.all([
    totalsByMonth(userId, year, month),
    listCategoriesByUser(userId),
    totalsByCategoryByMonth(userId, year, month),
    dailyTotalsForMonth(userId, year, month),
    categoryInsights(userId, year, month, 3),
  ]);

  const totalIncome = totals.incomeMinor / 100;
  const totalExpense =
    (totals.expenseFixedMinor + totals.expenseVariableMinor + totals.debtPaymentMinor) / 100;
  const totalSavings = totals.savingsContributionMinor / 100;
  const balance = totalIncome - totalExpense - totalSavings;

  const chartData = categories
    .map((c) => ({
      name: c.name,
      value: (byCategory.find((b) => b.categoryId === c.id)?.total ?? 0) / 100,
      color: c.color,
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  const sankeyExpenses = chartData.map((d) => ({
    name: d.name,
    value: d.value,
    color: d.color,
  }));

  const hasData = chartData.length > 0 || totals.incomeMinor > 0;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Reportes</h2>
          <p className="text-sm text-muted-foreground">
            {now.format('MMMM YYYY')} — análisis del mes y exportación a PDF.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/reportes/anual">
              <Calendar className="size-4" aria-hidden />
              Reporte anual
            </Link>
          </Button>
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
        </div>
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

      {!hasData ? (
        <EmptyState
          icon={BarChart3}
          title="Aún no hay datos"
          description="Cuando registres ingresos y gastos, aparecerán graficados por categoría aquí."
        />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Gastos por categoría</CardTitle>
              <CardDescription>Distribución de gastos del mes en curso.</CardDescription>
            </CardHeader>
            <CardContent>
              <CategoryChart data={chartData} currency={currency} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Flujo del mes</CardTitle>
              <CardDescription>Cómo se distribuye tu ingreso entre cada categoría.</CardDescription>
            </CardHeader>
            <CardContent>
              <SankeyFlow
                income={totalIncome}
                expenses={sankeyExpenses}
                savings={totalSavings}
                currency={currency}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mapa de gastos diario</CardTitle>
              <CardDescription>
                Más oscuro = más gasto. Pasa el cursor sobre un día para ver el monto.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ExpenseHeatmap data={daily} year={year} month={month} currency={currency} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tendencia vs meses anteriores</CardTitle>
              <CardDescription>Comparación con tu promedio de los últimos 3 meses.</CardDescription>
            </CardHeader>
            <CardContent>
              <CategoryInsights insights={insights} currency={currency} />
            </CardContent>
          </Card>
        </>
      )}
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
