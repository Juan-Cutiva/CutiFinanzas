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
import { AddDebtChargeButton } from '@/features/debts/components/add-debt-charge-button';
import {
  annualToMonthlyRate,
  calculateRemainingMonths,
  debtProgress,
} from '@/features/debts/domain';
import { getDebtForDetail } from '@/features/debts/queries';
import {
  TransactionList,
  type TxListItem,
} from '@/features/transactions/components/transaction-list';
import { ensureRecurringMaterialized } from '@/features/transactions/materialize';
import { listMovementsForDebt } from '@/features/transactions/queries';
import { listAccountsWithBalances, monthRange } from '@/lib/accounting';
import type { TransactionKind } from '@/lib/accounting/shared';
import { formatAmount, formatDate, formatMonthYear, nowInTz } from '@/lib/format';
import type { CurrencyCode } from '@/lib/money';
import type { UserId } from '@/types/ids';

export const metadata: Metadata = { title: 'Detalle de préstamo' };
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ y?: string; m?: string }>;
}

export default async function DebtDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await getOrCreateUser();
  const userId = user.id as UserId;
  // Self-healing: materializa recurrentes vencidas al cargar (no depende del cron).
  await ensureRecurringMaterialized(userId, user.timezone);

  const now = nowInTz(user.timezone);
  const year = Number.parseInt(sp.y ?? String(now.year()), 10);
  const month = Number.parseInt(sp.m ?? String(now.month() + 1), 10);
  const today = now.format('YYYY-MM-DD');
  const { to } = monthRange(year, month);
  const monthLabel = formatMonthYear(`${year}-${String(month).padStart(2, '0')}-01`);

  const [debtState, payments, accountsRaw, accountsState] = await Promise.all([
    getDebtForDetail(userId, id, to, today),
    listMovementsForDebt(userId, id),
    listAccountsByUser(userId),
    listAccountsWithBalances(userId, to, today),
  ]);
  if (!debtState) notFound();
  const stateById = new Map(accountsState.map((a) => [a.id, a]));

  const principal = Number(debtState.principalMinor) / 100;
  const realBalance = Number(debtState.realBalanceMinor) / 100;
  const projectedBalance = Number(debtState.projectedBalanceMinor) / 100;
  const showProjection = realBalance !== projectedBalance;
  const monthly = Number(debtState.monthlyPaymentMinor) / 100;
  const monthlyRate = annualToMonthlyRate(debtState.interestRateAnnual);
  const monthsLeft = calculateRemainingMonths(realBalance, monthlyRate, monthly);
  const progress = debtProgress(principal, realBalance);
  const totalPaid = Number(debtState.totalPaidMinor) / 100;

  const itemsForList: TxListItem[] = payments.map((t) => ({
    id: t.id,
    kind: t.kind as TransactionKind,
    amountMinor: t.amountMinor as bigint,
    currency: t.currency,
    transactionDate: t.transactionDate,
    description: t.description,
    notes: t.notes,
    accountId: t.accountId,
    counterAccountId: t.counterAccountId,
    categoryId: t.categoryId,
    debtId: t.debtId,
    savingsGoalId: t.savingsGoalId,
    receiptUrl: t.receiptUrl,
    isPaid: t.isPaid,
    recurringRuleId: t.recurringRuleId,
    account: t.account ? { name: t.account.name, type: t.account.type } : null,
    counterAccount: null,
    category: null,
  }));

  // Lista de cuentas con saldos para que el form del cargo pueda mostrar saldo
  // proyectado si el usuario marca "desembolso a cuenta destino".
  const accountsForForm = accountsRaw.map((a) => {
    const st = stateById.get(a.id);
    return {
      id: a.id,
      name: a.name,
      currency: a.currency,
      type: a.type,
      realMinor: (st?.realMinor ?? 0n).toString(),
      projectedMinor: (st?.projectedMinor ?? 0n).toString(),
      creditLimitMinor: a.creditLimitMinor ? String(a.creditLimitMinor) : null,
    };
  });
  const debtsForForm = [
    {
      id: debtState.id,
      name: debtState.name,
      currency: debtState.currency,
      realBalanceMinor: debtState.realBalanceMinor.toString(),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2 h-8">
          <Link href="/deudas">
            <ArrowLeft className="mr-1 size-4" /> Volver a préstamos
          </Link>
        </Button>
        <AddDebtChargeButton
          accounts={accountsForForm}
          debts={debtsForForm}
          defaultCurrency={debtState.currency}
          defaultDate={today}
        />
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-amount-negative/15 text-amount-negative">
                <CreditCard className="size-6" aria-hidden />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-semibold tracking-tight md:text-2xl">
                  {debtState.name}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Inicio {formatDate(debtState.startDate)}
                  {debtState.endDate ? ` · fin previsto ${formatDate(debtState.endDate)}` : ''}
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
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Saldo actual</p>
            <p className="font-mono tabular-nums text-3xl font-semibold tracking-tight text-amount-negative">
              {formatAmount(realBalance, debtState.currency as CurrencyCode)}
            </p>
            <p className="text-xs text-muted-foreground">
              de {formatAmount(principal, debtState.currency as CurrencyCode)} iniciales
            </p>
            {showProjection ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Saldo estimado fin de {monthLabel}:{' '}
                <span className="font-mono tabular-nums font-medium text-foreground">
                  {formatAmount(projectedBalance, debtState.currency as CurrencyCode)}
                </span>{' '}
                — los descuentos por cuotas fijas se aplican al pasar la fecha de pago.
              </p>
            ) : null}
          </div>

          <div>
            <Progress value={Math.round(progress * 100)} />
            <p className="mt-1 text-xs text-muted-foreground">
              {Math.round(progress * 100)}% pagado · cuota{' '}
              {formatAmount(monthly, debtState.currency as CurrencyCode)}/mes
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t pt-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Pagado a la fecha</p>
              <p className="font-mono tabular-nums font-semibold">
                {formatAmount(totalPaid, debtState.currency as CurrencyCode)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Cuotas pagadas</p>
              <p className="font-mono tabular-nums font-semibold">
                {debtState.paidInstallments}
                {debtState.totalInstallments ? ` / ${debtState.totalInstallments}` : ''}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tasa anual</p>
              <p className="font-mono tabular-nums font-semibold">
                {debtState.interestRateAnnual ? `${debtState.interestRateAnnual.toFixed(2)}%` : '—'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Historial ({itemsForList.length})
        </h3>
        {itemsForList.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="Sin movimientos registrados"
            description="Cuando hagas un pago o registres un cargo a este préstamo aparecerá aquí."
          />
        ) : (
          <TransactionList items={itemsForList} />
        )}
      </section>
    </div>
  );
}
