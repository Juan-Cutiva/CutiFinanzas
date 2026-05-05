import { ArrowLeft, CreditCard } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Progress } from '@/components/ui/progress';
import { getOrCreateUser } from '@/db/queries/users';
import { listAccountsByUser } from '@/features/accounts/queries';
import { listCategoriesByUser } from '@/features/categories/queries';
import { DebtUsagesList } from '@/features/debts/components/debt-usages-list';
import { RecordDebtUsageButton } from '@/features/debts/components/record-debt-usage-button';
import {
  annualToMonthlyRate,
  calculateRemainingMonths,
  debtProgress,
} from '@/features/debts/domain';
import {
  getDebtById,
  getDebtPayments,
  getDebtUsages,
  listDebtsByUser,
} from '@/features/debts/queries';
import { listSavingsGoals } from '@/features/savings/queries';
import { TransactionList } from '@/features/transactions/components/transaction-list';
import { formatAmount, formatDate } from '@/lib/format';
import type { CurrencyCode } from '@/lib/money';

export const metadata: Metadata = { title: 'Detalle de deuda' };
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function DebtDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await getOrCreateUser();
  const debt = await getDebtById(user.id as never, id);
  if (!debt) notFound();

  const userId = user.id as never;
  const [payments, usages, categories, accountsRaw, debtsRaw, goalsRaw] = await Promise.all([
    getDebtPayments(userId, debt.id),
    getDebtUsages(userId, debt.id),
    listCategoriesByUser(userId),
    listAccountsByUser(userId),
    listDebtsByUser(userId),
    listSavingsGoals(userId),
  ]);
  const accounts = accountsRaw.map((a) => ({
    id: a.id,
    name: a.name,
    currency: a.currency,
    type: a.type,
  }));
  const debts = debtsRaw.map((d) => ({ id: d.id, name: d.name, currency: d.currency }));
  const savingsGoals = goalsRaw.map((g) => ({ id: g.id, name: g.name, currency: g.currency }));

  const initial = Number(debt.initialAmountMinor) / 100;
  const balance = Number(debt.currentBalanceMinor) / 100;
  const monthly = Number(debt.monthlyPaymentMinor) / 100;
  const monthlyRate = annualToMonthlyRate(
    debt.interestRateAnnual ? Number(debt.interestRateAnnual) : null,
  );
  const monthsLeft = calculateRemainingMonths(balance, monthlyRate, monthly);
  const progress = debtProgress(initial, balance);
  const totalPaid = payments.reduce((acc, p) => acc + Number(p.amountMinor), 0) / 100;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2 h-8">
          <Link href="/deudas">
            <ArrowLeft className="mr-1 size-4" /> Volver a deudas
          </Link>
        </Button>
        <RecordDebtUsageButton debtId={debt.id} debtName={debt.name} />
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-amount-negative/15 text-amount-negative">
                <CreditCard className="size-6" aria-hidden />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-semibold tracking-tight md:text-2xl">{debt.name}</h2>
                <p className="text-xs text-muted-foreground">
                  Inicio {formatDate(debt.startDate)}
                  {debt.endDate ? ` · fin previsto ${formatDate(debt.endDate)}` : ''}
                </p>
              </div>
            </div>
            {monthsLeft !== null && monthsLeft > 0 ? (
              <Badge variant="secondary">{monthsLeft} meses restantes</Badge>
            ) : monthsLeft === 0 ? (
              <Badge variant="success">Pagada</Badge>
            ) : (
              <Badge variant="warning">Pago no cubre interés</Badge>
            )}
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Saldo restante</p>
            <p className="font-mono tabular-nums text-3xl font-semibold tracking-tight text-amount-negative">
              {formatAmount(balance, debt.currency as CurrencyCode)}
            </p>
            <p className="text-xs text-muted-foreground">
              de {formatAmount(initial, debt.currency as CurrencyCode)} iniciales
            </p>
          </div>

          <div>
            <Progress value={Math.round(progress * 100)} />
            <p className="mt-1 text-xs text-muted-foreground">
              {Math.round(progress * 100)}% pagado · cuota{' '}
              {formatAmount(monthly, debt.currency as CurrencyCode)}/mes
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t pt-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Pagado a la fecha</p>
              <p className="font-mono tabular-nums font-semibold">
                {formatAmount(totalPaid, debt.currency as CurrencyCode)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Cuotas pagadas</p>
              <p className="font-mono tabular-nums font-semibold">
                {debt.paidInstallments}
                {debt.totalInstallments ? ` / ${debt.totalInstallments}` : ''}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tasa anual</p>
              <p className="font-mono tabular-nums font-semibold">
                {debt.interestRateAnnual ? `${Number(debt.interestRateAnnual).toFixed(2)}%` : '—'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {usages.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Aumentos de saldo ({usages.length})
          </h3>
          <DebtUsagesList items={usages as never} />
        </section>
      ) : null}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Historial de pagos ({payments.length})
        </h3>
        {payments.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="Sin pagos registrados"
            description="Cuando hagas un pago a esta deuda aparecerá aquí."
          />
        ) : (
          <TransactionList
            items={payments as never}
            accounts={accounts}
            categories={categories}
            debts={debts}
            savingsGoals={savingsGoals}
          />
        )}
      </section>
    </div>
  );
}
