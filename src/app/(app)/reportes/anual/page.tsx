import { Download } from 'lucide-react';
import type { Metadata } from 'next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getOrCreateUser } from '@/db/queries/users';
import { YearlyChart } from '@/features/reports/components/yearly-chart';
import { ensureRecurringMaterialized } from '@/features/transactions/materialize';
import { getPeriodTotals, monthRange } from '@/lib/accounting';
import { formatAmount, nowInTz } from '@/lib/format';
import type { CurrencyCode } from '@/lib/money';
import type { UserId } from '@/types/ids';

export const metadata: Metadata = { title: 'Reporte anual' };
export const dynamic = 'force-dynamic';

interface SearchParams {
  searchParams: Promise<{ year?: string }>;
}

export default async function ReporteAnualPage({ searchParams }: SearchParams) {
  const user = await getOrCreateUser();
  const userId = user.id as UserId;
  // Self-healing: materializa recurrentes vencidas al cargar (no depende del cron).
  await ensureRecurringMaterialized(userId, user.timezone);
  const currency = user.defaultCurrency as CurrencyCode;
  const params = await searchParams;
  const year = Number.parseInt(params.year ?? String(nowInTz(user.timezone).year()), 10);

  // Lanza los 12 totales mensuales en paralelo en vez de 12 awaits secuenciales.
  // Para los meses que se extienden a futuro respecto a hoy incluye virtuales,
  // así el reporte refleja también los movimientos programados (recurrentes
  // pendientes de materializar).
  const today = nowInTz(user.timezone).format('YYYY-MM-DD');
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const totals = await Promise.all(
    months.map((m) => {
      const { from, to } = monthRange(year, m);
      const isFutureRange = to > today;
      return getPeriodTotals(userId, from, to, {
        includeVirtuals: isFutureRange,
        today,
      });
    }),
  );
  const data = totals.map((t, i) => {
    const inc = Number(t.incomeMinor);
    const exp = Number(t.expenseMinor);
    return { month: i + 1, incomeMinor: inc, expenseMinor: exp, balanceMinor: inc - exp };
  });

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
