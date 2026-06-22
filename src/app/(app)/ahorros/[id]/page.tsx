import { ArrowLeft, PiggyBank } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Progress } from '@/components/ui/progress';
import { getOrCreateUser } from '@/db/queries/users';
import {
  TransactionList,
  type TxListItem,
} from '@/features/transactions/components/transaction-list';
import { ensureRecurringMaterialized } from '@/features/transactions/materialize';
import { listContributionsForGoal } from '@/features/transactions/queries';
import { getSavingsGoalState, monthRange } from '@/lib/accounting';
import type { TransactionKind } from '@/lib/accounting/shared';
import { formatAmount, formatDate, formatMonthYear, nowInTz } from '@/lib/format';
import type { CurrencyCode } from '@/lib/money';
import type { UserId } from '@/types/ids';

export const metadata: Metadata = { title: 'Detalle de meta' };
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ y?: string; m?: string }>;
}

export default async function AhorroDetailPage({ params, searchParams }: Props) {
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

  const [goalState, contributions] = await Promise.all([
    getSavingsGoalState(userId, id, today, to),
    listContributionsForGoal(userId, id),
  ]);
  if (!goalState) notFound();

  const currency = goalState.currency as CurrencyCode;
  const target = Number(goalState.targetAmountMinor) / 100;
  const current = Number(goalState.currentAmountMinor) / 100;
  const projected = Number(goalState.projectedAmountMinor) / 100;
  const monthly = Number(goalState.monthlyContributionMinor) / 100;
  const pct = target > 0 ? Math.round((current / target) * 100) : 0;
  const projectedPct = target > 0 ? Math.round((projected / target) * 100) : 0;
  const reached = pct >= 100;

  const itemsForList: TxListItem[] = contributions.map((t) => ({
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

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 h-8">
          <Link href="/ahorros">
            <ArrowLeft className="mr-1 size-4" /> Volver a metas
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div
                className="grid size-12 shrink-0 place-items-center rounded-lg"
                style={{
                  backgroundColor: `color-mix(in oklch, ${goalState.color} 18%, transparent)`,
                  color: goalState.color,
                }}
              >
                <PiggyBank className="size-6" aria-hidden />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-semibold tracking-tight md:text-2xl">
                  {goalState.name}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Inicio {formatDate(goalState.startDate)}
                  {goalState.targetDate ? ` · meta ${formatDate(goalState.targetDate)}` : ''}
                </p>
              </div>
            </div>
            {reached ? (
              <Badge variant="success">Cumplida</Badge>
            ) : (
              <Badge variant="outline" className="font-normal">
                {pct}% completado
              </Badge>
            )}
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Aportado a la fecha
            </p>
            <p className="font-mono tabular-nums text-3xl font-semibold tracking-tight text-amount-positive">
              {formatAmount(current, currency)}
            </p>
            <p className="text-xs text-muted-foreground">
              de {formatAmount(target, currency)} meta
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Estimado fin de {monthLabel}:{' '}
              <span className="font-mono tabular-nums font-medium text-foreground">
                {formatAmount(projected, currency)}
              </span>{' '}
              ({projectedPct}%)
              {projected !== current ? ' — incluye aportes recurrentes programados' : null}.
            </p>
          </div>

          <div>
            <Progress value={Math.min(100, pct)} />
            <p className="mt-1 text-xs text-muted-foreground">
              {pct}% pagado · aporte sugerido {formatAmount(monthly, currency)}/mes
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t pt-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Cumplido</p>
              <p className="font-mono tabular-nums font-semibold">{pct}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Aportes registrados</p>
              <p className="font-mono tabular-nums font-semibold">{itemsForList.length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Aporte sugerido</p>
              <p className="font-mono tabular-nums font-semibold">
                {formatAmount(monthly, currency)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Historial de aportes ({itemsForList.length})
        </h3>
        {itemsForList.length === 0 ? (
          <EmptyState
            icon={PiggyBank}
            title="Sin aportes registrados"
            description='Cuando registres un movimiento tipo "Aporte a meta de ahorro" aparecerá aquí.'
          />
        ) : (
          <TransactionList items={itemsForList} />
        )}
      </section>
    </div>
  );
}
