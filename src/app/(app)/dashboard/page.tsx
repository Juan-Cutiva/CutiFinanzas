import { PiggyBank, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import type { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getOrCreateUser } from '@/db/queries/users';
import { listAccountsWithBalance } from '@/features/accounts/queries';
import { listSavingsGoals } from '@/features/savings/queries';
import { totalsByMonth } from '@/features/transactions/queries';
import { dayjs, formatAmount } from '@/lib/format';
import type { CurrencyCode } from '@/lib/money';

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

  const [accounts, totals, goals] = await Promise.all([
    listAccountsWithBalance(userId),
    totalsByMonth(userId, now.year(), now.month() + 1),
    listSavingsGoals(userId),
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

  const goalsTotalTarget = goals.reduce((acc, g) => acc + Number(g.targetAmountMinor) / 100, 0);
  const goalsTotalCurrent = goals.reduce((acc, g) => acc + Number(g.currentAmountMinor) / 100, 0);

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

      {goals.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Metas de ahorro</CardTitle>
            <CardDescription>
              Total acumulado: {formatAmount(goalsTotalCurrent, currency)} de{' '}
              {formatAmount(goalsTotalTarget, currency)}
            </CardDescription>
          </CardHeader>
          <CardContent />
        </Card>
      ) : null}

      {accounts.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Empieza por aquí</CardTitle>
            <CardDescription>
              Crea tu primera cuenta para empezar a registrar movimientos.
            </CardDescription>
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
