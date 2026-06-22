import { ArrowLeft, CreditCard, Wallet } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { getOrCreateUser } from '@/db/queries/users';
import { getAccountById } from '@/features/accounts/queries';
import { ACCOUNT_TYPE_LABELS, type AccountTypeCode } from '@/features/accounts/schema';
import { listCategoriesByUser } from '@/features/categories/queries';
import {
  TransactionList,
  type TxListItem,
} from '@/features/transactions/components/transaction-list';
import { ensureRecurringMaterialized } from '@/features/transactions/materialize';
import { listTransactionsByAccount } from '@/features/transactions/queries';
import {
  getCreditCardState,
  getProjectedBalanceMinor,
  listVirtualsForMonth,
  monthRange,
} from '@/lib/accounting';
import type { TransactionKind } from '@/lib/accounting/shared';
import { formatAmount, nowInTz } from '@/lib/format';
import type { CurrencyCode } from '@/lib/money';
import type { UserId } from '@/types/ids';

export const metadata: Metadata = { title: 'Detalle de cuenta' };
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ y?: string; m?: string }>;
}

export default async function AccountDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await getOrCreateUser();
  const userId = user.id as UserId;
  // Self-healing: materializa recurrentes vencidas al cargar (no depende del cron).
  await ensureRecurringMaterialized(userId, user.timezone);
  const account = await getAccountById(userId, id);
  if (!account) notFound();

  const now = nowInTz(user.timezone);
  const year = Number.parseInt(sp.y ?? String(now.year()), 10);
  const month = Number.parseInt(sp.m ?? String(now.month() + 1), 10);
  const today = now.format('YYYY-MM-DD');
  const { from, to } = monthRange(year, month);

  const isCC = account.type === 'credit_card';

  const [txs, balance, ccState, allVirtuals, categories] = await Promise.all([
    listTransactionsByAccount(userId, account.id, from, to),
    getProjectedBalanceMinor(userId, account.id, to, today),
    isCC ? getCreditCardState(userId, account.id, today) : Promise.resolve(null),
    listVirtualsForMonth(userId, year, month),
    listCategoriesByUser(userId),
  ]);

  const realMajor = Number(balance.realMinor) / 100;
  const projectedMajor = Number(balance.projectedMinor) / 100;
  const showProjection = balance.realMinor !== balance.projectedMinor;

  // Filtrar virtuales que afectan a esta cuenta (origen o destino).
  const virtuals = allVirtuals.filter(
    (v) => v.accountId === account.id || v.counterAccountId === account.id,
  );

  const realItems: TxListItem[] = txs.map((t) => ({
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
    counterAccount: t.counterAccount ? { name: t.counterAccount.name } : null,
    category: t.category
      ? { name: t.category.name, color: t.category.color, icon: t.category.icon }
      : null,
    debt: t.debt ? { name: t.debt.name } : null,
  }));

  const itemsForList: TxListItem[] = [...realItems, ...virtuals].sort((a, b) =>
    a.transactionDate < b.transactionDate ? 1 : -1,
  );

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 h-8">
          <Link href="/cuentas">
            <ArrowLeft className="mr-1 size-4" /> Volver a cuentas
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-start gap-3">
            <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              {isCC ? (
                <CreditCard className="size-6" aria-hidden />
              ) : (
                <Wallet className="size-6" aria-hidden />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-semibold tracking-tight md:text-2xl">{account.name}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <Badge variant="outline" className="font-normal">
                  {ACCOUNT_TYPE_LABELS[account.type as AccountTypeCode]}
                </Badge>
                <span className="font-mono uppercase tracking-wide">{account.currency}</span>
                {account.institution ? (
                  <>
                    <span aria-hidden>·</span>
                    <span className="truncate">{account.institution}</span>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {isCC ? 'Saldo pendiente con el banco' : 'Saldo disponible'}
            </p>
            <p
              className={`font-mono tabular-nums text-3xl font-semibold tracking-tight ${
                isCC
                  ? realMajor > 0
                    ? 'text-amount-negative'
                    : 'text-foreground'
                  : realMajor >= 0
                    ? 'text-amount-positive'
                    : 'text-amount-negative'
              }`}
            >
              {formatAmount(realMajor, account.currency as CurrencyCode)}
            </p>
            {showProjection ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Proyectado fin de mes:{' '}
                <span className="font-mono tabular-nums font-medium text-foreground">
                  {formatAmount(projectedMajor, account.currency as CurrencyCode)}
                </span>
              </p>
            ) : null}
            {isCC && ccState ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {ccState.creditLimitMinor !== null ? (
                  <>
                    Cupo total{' '}
                    {formatAmount(
                      Number(ccState.creditLimitMinor) / 100,
                      account.currency as CurrencyCode,
                    )}
                    {' · '}
                    disponible{' '}
                    {formatAmount(
                      Number(ccState.availableMinor ?? 0n) / 100,
                      account.currency as CurrencyCode,
                    )}
                  </>
                ) : (
                  'Sin cupo configurado'
                )}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Movimientos del mes ({itemsForList.length})
        </h3>
        {itemsForList.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="Sin movimientos este mes"
            description="Esta cuenta aún no tiene transacciones en el período."
          />
        ) : (
          <TransactionList
            items={itemsForList}
            categories={categories.map((c) => ({ id: c.id, name: c.name }))}
            viewAccountId={account.id}
          />
        )}
      </section>
    </div>
  );
}
