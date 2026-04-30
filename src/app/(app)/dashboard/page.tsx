import { CreditCard, PiggyBank, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import type { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { getOrCreateUser } from '@/db/queries/users';
import { listAccountsWithBalance } from '@/features/accounts/queries';
import {
  annualToMonthlyRate,
  calculateRemainingMonths,
  debtProgress,
} from '@/features/debts/domain';
import { listDebtsByUser } from '@/features/debts/queries';
import { listSavingsGoals } from '@/features/savings/queries';
import { totalsByMonth, totalsForRange } from '@/features/transactions/queries';
import { dayjs, formatAmount } from '@/lib/format';
import type { CurrencyCode } from '@/lib/money';
import { type PayFrequency, periodsForMonth } from '@/lib/periods';

export const metadata: Metadata = { title: 'Resumen' };
export const dynamic = 'force-dynamic';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export default async function DashboardPage() {
  const user = await getOrCreateUser();
  const userId = user.id as never;
  const currency = user.defaultCurrency as CurrencyCode;
  const now = dayjs();
  const year = now.year();
  const month = now.month() + 1;

  const periods = periodsForMonth(year, month, user.payFrequency as PayFrequency);

  const [accounts, totals, goals, debts, periodTotals] = await Promise.all([
    listAccountsWithBalance(userId),
    totalsByMonth(userId, year, month),
    listSavingsGoals(userId),
    listDebtsByUser(userId),
    Promise.all(periods.map((p) => totalsForRange(userId, p.from, p.to))),
  ]);

  const incomeMajor = totals.incomeMinor / 100;
  const expenseMajor =
    (totals.expenseFixedMinor +
      totals.expenseVariableMinor +
      totals.debtPaymentMinor +
      totals.savingsContributionMinor) /
    100;
  const savedMajor = totals.savingsContributionMinor / 100;

  const balanceMajor = accounts
    .filter((a) => a.currency === currency)
    .reduce((acc, a) => acc + Number(a.balanceMinor) / 100, 0);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {greeting()}
          {user.name ? `, ${user.name.split(' ')[0]}` : ''}
        </h2>
        <p className="text-sm text-muted-foreground">Resumen de {now.format('MMMM YYYY')}.</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<TrendingUp className="size-4 text-[color:var(--income)]" aria-hidden />}
          label="Ingresos del mes"
          value={formatAmount(incomeMajor, currency)}
        />
        <KpiCard
          icon={<TrendingDown className="size-4 text-[color:var(--expense)]" aria-hidden />}
          label="Gastos del mes"
          value={formatAmount(expenseMajor, currency)}
        />
        <KpiCard
          icon={<Wallet className="size-4 text-primary" aria-hidden />}
          label="Balance disponible"
          value={formatAmount(balanceMajor, currency)}
          tone={balanceMajor >= 0 ? 'positive' : 'negative'}
        />
        <KpiCard
          icon={<PiggyBank className="size-4 text-[color:var(--info)]" aria-hidden />}
          label="Ahorrado este mes"
          value={formatAmount(savedMajor, currency)}
        />
      </section>

      {periods.length > 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>Balance por período</CardTitle>
            <CardDescription>
              Cálculo según tu frecuencia de pago configurada en Ajustes.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {periods.map((p, i) => {
              const t = periodTotals[i];
              if (!t) return null;
              const balance = t.balanceMinor / 100;
              return (
                <div key={p.label} className="rounded-lg border border-border/60 bg-muted/30 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {p.label}
                  </p>
                  <p
                    className={`mt-1 font-mono tabular-nums text-lg font-semibold ${
                      balance >= 0 ? 'text-amount-positive' : 'text-amount-negative'
                    }`}
                  >
                    {formatAmount(balance, currency, { signDisplay: 'always' })}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ingresos {formatAmount(t.incomeMinor / 100, currency)} · Gastos{' '}
                    {formatAmount(t.expenseMinor / 100, currency)}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {goals.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Metas de ahorro</CardTitle>
              <CardDescription>Progreso hacia cada objetivo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {goals.map((g) => {
                const target = Number(g.targetAmountMinor) / 100;
                const current = Number(g.currentAmountMinor) / 100;
                const pct = target > 0 ? Math.round((current / target) * 100) : 0;
                return (
                  <div key={g.id}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate font-medium">{g.name}</span>
                      <span className="font-mono tabular-nums text-xs text-muted-foreground">
                        {formatAmount(current, g.currency as CurrencyCode)} /{' '}
                        {formatAmount(target, g.currency as CurrencyCode)}
                      </span>
                    </div>
                    <Progress
                      className="mt-1.5"
                      value={Math.min(100, pct)}
                      indicatorClassName={pct >= 100 ? 'bg-[color:var(--success)]' : 'bg-primary'}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">{pct}%</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ) : null}

        {debts.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Deudas activas</CardTitle>
              <CardDescription>Saldo restante y % pagado.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {debts.map((d) => {
                const initial = Number(d.initialAmountMinor) / 100;
                const balance = Number(d.currentBalanceMinor) / 100;
                const monthly = Number(d.monthlyPaymentMinor) / 100;
                const monthlyRate = annualToMonthlyRate(
                  d.interestRateAnnual ? Number(d.interestRateAnnual) : null,
                );
                const monthsLeft = calculateRemainingMonths(balance, monthlyRate, monthly);
                const progress = Math.round(debtProgress(initial, balance) * 100);
                return (
                  <div key={d.id}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate font-medium">{d.name}</span>
                      <span className="font-mono tabular-nums text-xs text-muted-foreground">
                        {formatAmount(balance, d.currency as CurrencyCode)} de{' '}
                        {formatAmount(initial, d.currency as CurrencyCode)}
                      </span>
                    </div>
                    <Progress
                      className="mt-1.5"
                      value={progress}
                      indicatorClassName={
                        progress >= 100 ? 'bg-[color:var(--success)]' : 'bg-primary'
                      }
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {progress}% pagado
                      {monthsLeft !== null && monthsLeft > 0
                        ? ` · ${monthsLeft} meses restantes`
                        : monthsLeft === 0
                          ? ' · Pagada'
                          : ''}
                    </p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ) : null}
      </div>

      {accounts.length === 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <CreditCard className="size-5 text-primary" aria-hidden />
              <div>
                <CardTitle>Empieza por aquí</CardTitle>
                <CardDescription>
                  Crea tu primera cuenta para empezar a registrar movimientos.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent />
        </Card>
      ) : null}
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: 'positive' | 'negative';
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between p-5 pb-2">
        <CardDescription className="text-xs font-medium uppercase tracking-wide">
          {label}
        </CardDescription>
        {icon}
      </CardHeader>
      <CardContent className="p-5 pt-0">
        <p
          className={`font-mono tabular-nums text-2xl font-semibold tracking-tight ${
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
