import { Download } from 'lucide-react';
import type { Metadata } from 'next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getOrCreateUser } from '@/db/queries/users';
import { YearlyChart } from '@/features/reports/components/yearly-chart';
import { totalsByMonthForYear } from '@/features/transactions/queries';
import { dayjs, formatAmount } from '@/lib/format';
import type { CurrencyCode } from '@/lib/money';

export const metadata: Metadata = { title: 'Reporte anual' };
export const dynamic = 'force-dynamic';

interface SearchParams {
  searchParams: Promise<{ year?: string }>;
}

export default async function ReporteAnualPage({ searchParams }: SearchParams) {
  const user = await getOrCreateUser();
  const userId = user.id as never;
  const currency = user.defaultCurrency as CurrencyCode;
  const params = await searchParams;
  const year = Number.parseInt(params.year ?? String(dayjs().year()), 10);

  const data = await totalsByMonthForYear(userId, year);

  const totalIncome = data.reduce((s, d) => s + d.incomeMinor, 0) / 100;
  const totalExpense = data.reduce((s, d) => s + d.expenseMinor, 0) / 100;
  const balance = totalIncome - totalExpense;
  const monthsWithIncome = data.filter((d) => d.incomeMinor > 0).length;
  const avgIncome = monthsWithIncome > 0 ? totalIncome / monthsWithIncome : 0;
  const monthsWithExpense = data.filter((d) => d.expenseMinor > 0).length;
  const avgExpense = monthsWithExpense > 0 ? totalExpense / monthsWithExpense : 0;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Reporte anual {year}
          </h2>
          <p className="text-sm text-muted-foreground">
            Evolución mes a mes de tus ingresos, gastos y balance.
          </p>
        </div>
        <Button asChild>
          <a href={`/api/reports/yearly?year=${year}`} target="_blank" rel="noreferrer">
            <Download className="size-4" aria-hidden />
            Descargar PDF anual
          </a>
        </Button>
      </header>

      <section className="grid gap-3 sm:grid-cols-4">
        <SummaryCard label="Ingreso total" value={formatAmount(totalIncome, currency)} />
        <SummaryCard label="Gasto total" value={formatAmount(totalExpense, currency)} />
        <SummaryCard
          label="Balance"
          value={formatAmount(balance, currency)}
          tone={balance >= 0 ? 'positive' : 'negative'}
        />
        <SummaryCard
          label="Promedio mensual"
          value={formatAmount(avgIncome - avgExpense, currency)}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Evolución mensual</CardTitle>
          <CardDescription>Barras: ingresos vs gastos. Línea: balance neto.</CardDescription>
        </CardHeader>
        <CardContent>
          <YearlyChart data={data} currency={currency} />
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
  tone?: 'positive' | 'negative';
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p
          className={`mt-1 font-mono tabular-nums text-lg font-semibold ${
            tone === 'positive'
              ? 'text-amount-positive'
              : tone === 'negative'
                ? 'text-amount-negative'
                : ''
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
