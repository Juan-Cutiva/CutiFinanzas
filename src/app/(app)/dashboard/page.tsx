import { CreditCard, PiggyBank, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import type { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { getOrCreateUser } from '@/db/queries/users';
import {
  annualToMonthlyRate,
  calculateRemainingMonths,
  debtProgress,
} from '@/features/debts/domain';
import { ensureRecurringMaterialized } from '@/features/transactions/materialize';
import {
  getPeriodTotals,
  isAsset,
  listAccountsWithBalances,
  listDebtsWithState,
  listSavingsGoalsWithState,
  monthRange,
  subPeriodsForMonth,
} from '@/lib/accounting';
import { formatAmount, formatMonthYear, nowInTz } from '@/lib/format';
import type { CurrencyCode } from '@/lib/money';
import type { UserId } from '@/types/ids';

export const metadata: Metadata = { title: 'Resumen' };
export const dynamic = 'force-dynamic';

function greeting(timezone: string): string {
  const hourStr = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: timezone,
  }).format(new Date());
  const h = Number.parseInt(hourStr, 10);
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

interface PageProps {
  searchParams: Promise<{ y?: string; m?: string }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const user = await getOrCreateUser();
  const userId = user.id as UserId;
  // Self-healing: materializa recurrentes vencidas al cargar (no depende del cron).
  await ensureRecurringMaterialized(userId, user.timezone);
  const currency = user.defaultCurrency as CurrencyCode;
  const params = await searchParams;
  const now = nowInTz(user.timezone);
  const year = Number.parseInt(params.y ?? String(now.year()), 10);
  const month = Number.parseInt(params.m ?? String(now.month() + 1), 10);
  const monthLabel = formatMonthYear(`${year}-${String(month).padStart(2, '0')}-01`);

  const todayIso = now.format('YYYY-MM-DD');
  const { from, to } = monthRange(year, month);
  const isFutureMonth = to > todayIso;

  const subPeriods = subPeriodsForMonth(year, month, user.payAnchorDates ?? [6, 21]);
  const primaryAccountId = user.primaryAccountId ?? undefined;

  const [accounts, totals, savingsState, debtsState, subPeriodTotals] = await Promise.all([
    listAccountsWithBalances(userId, to, todayIso),
    getPeriodTotals(userId, from, to, { includeVirtuals: isFutureMonth, today: todayIso }),
    listSavingsGoalsWithState(userId, todayIso),
    listDebtsWithState(userId, to, todayIso),
    // Si hay cuenta principal definida, las quincenas filtran solo movimientos
    // donde esa cuenta es origen o destino. Refleja el mental model "mi quincena".
    Promise.all(
      subPeriods.map((p) =>
        getPeriodTotals(userId, p.from, p.to, {
          includeVirtuals: isFutureMonth,
          today: todayIso,
          accountId: primaryAccountId,
        }),
      ),
    ),
  ]);

  const incomeMajor = Number(totals.incomeMinor) / 100;
  const expenseMajor = Number(totals.expenseMinor) / 100;
  const savedMajor = Number(totals.savingsMinor) / 100;
  const goalsTotalCurrent = savingsState
    .filter((g) => g.currency === currency)
    .reduce((acc, g) => acc + Number(g.currentAmountMinor) / 100, 0);

  // Filtra cuentas según las que el usuario eligió mostrar en el dashboard.
  // Si dashboardAccountIds es null/vacío, se muestran todas.
  const visibleSet =
    user.dashboardAccountIds && user.dashboardAccountIds.length > 0
      ? new Set(user.dashboardAccountIds)
      : null;
  const visibleAccounts = visibleSet ? accounts.filter((a) => visibleSet.has(a.id)) : accounts;
  const sameCurrency = visibleAccounts.filter((a) => a.currency === currency);
  const assetBalanceProj = sameCurrency
    .filter((a) => isAsset(a.type))
    .reduce((acc, a) => acc + Number(a.projectedMinor) / 100, 0);
  const assetBalanceToday = sameCurrency
    .filter((a) => isAsset(a.type))
    .reduce((acc, a) => acc + Number(a.realMinor) / 100, 0);
  const ccDebtToday = sameCurrency
    .filter((a) => !isAsset(a.type))
    .reduce((acc, a) => acc + Number(a.realMinor) / 100, 0);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {greeting(user.timezone)}
          {user.name ? `, ${user.name.split(' ')[0]}` : ''}
        </h2>
        <p className="text-sm text-muted-foreground">Resumen de {monthLabel}.</p>
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
          label={isFutureMonth ? 'Balance proyectado fin de mes' : 'Balance disponible'}
          value={formatAmount(assetBalanceProj, currency)}
          tone={assetBalanceProj >= 0 ? 'positive' : 'negative'}
          hint={
            isFutureMonth
              ? `Hoy: ${formatAmount(assetBalanceToday, currency)} — los pagos fijos se aplican al pasar la fecha.`
              : ccDebtToday > 0
                ? `Deuda en tarjetas: ${formatAmount(ccDebtToday, currency)}`
                : 'Solo cuentas en efectivo, débito y ahorros'
          }
        />
        <KpiCard
          icon={<PiggyBank className="size-4 text-[color:var(--info)]" aria-hidden />}
          label="Acumulado en metas"
          value={formatAmount(goalsTotalCurrent, currency)}
          hint={`+${formatAmount(savedMajor, currency)} aportado este mes`}
        />
      </section>

      {subPeriods.length > 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>Balance por período</CardTitle>
            <CardDescription>
              Cortes en tus días de cobro ({(user.payAnchorDates ?? [6, 21]).join(' y ')}).
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {subPeriods.map((p, i) => {
              const t = subPeriodTotals[i];
              if (!t) return null;
              const inc = Number(t.incomeMinor) / 100;
              const exp = Number(t.expenseMinor) / 100;
              const balance = inc - exp;
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
                    Ingresos {formatAmount(inc, currency)} · Gastos {formatAmount(exp, currency)}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {savingsState.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Metas de ahorro</CardTitle>
              <CardDescription>Progreso hacia cada objetivo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {savingsState.map((g) => {
                const target = Number(g.targetAmountMinor) / 100;
                const current = Number(g.currentAmountMinor) / 100;
                const pct = Math.round(g.progress * 100);
                return (
                  <div key={g.id}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate font-medium">{g.name}</span>
                      <span className="font-mono tabular-nums text-xs text-muted-foreground">
                        {formatAmount(current, g.currency as CurrencyCode)} /{' '}
                        {formatAmount(target, g.currency as CurrencyCode)}
                      </span>
                    </div>
                    <Progress className="mt-1.5" value={Math.min(100, pct)} />
                    <p className="mt-1 text-xs text-muted-foreground">{pct}%</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ) : null}

        {debtsState.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Préstamos activos</CardTitle>
              <CardDescription>Saldo restante y proyección fin de mes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {debtsState.map((d) => {
                const principal = Number(d.principalMinor) / 100;
                const realBal = Number(d.realBalanceMinor) / 100;
                const projBal = Number(d.projectedBalanceMinor) / 100;
                const monthly = Number(d.monthlyPaymentMinor) / 100;
                const showProjection = realBal !== projBal;
                const monthlyRate = annualToMonthlyRate(d.interestRateAnnual);
                const monthsLeft = calculateRemainingMonths(realBal, monthlyRate, monthly);
                const progress = Math.round(debtProgress(principal, realBal) * 100);
                return (
                  <div key={d.id}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate font-medium">{d.name}</span>
                      <span className="font-mono tabular-nums text-xs text-muted-foreground">
                        {formatAmount(realBal, d.currency as CurrencyCode)} de{' '}
                        {formatAmount(principal, d.currency as CurrencyCode)}
                      </span>
                    </div>
                    <Progress className="mt-1.5" value={progress} />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {progress}% pagado
                      {monthsLeft !== null && monthsLeft > 0
                        ? ` · ${monthsLeft} meses restantes`
                        : monthsLeft === 0
                          ? ' · Pagada'
                          : ''}
                      {showProjection
                        ? ` · estimado fin de mes ${formatAmount(projBal, d.currency as CurrencyCode)}`
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
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: 'positive' | 'negative';
  hint?: string;
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
          className={`truncate font-mono tabular-nums text-2xl font-semibold tracking-tight ${
            tone === 'positive'
              ? 'text-amount-positive'
              : tone === 'negative'
                ? 'text-amount-negative'
                : ''
          }`}
          title={value}
        >
          {value}
        </p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
