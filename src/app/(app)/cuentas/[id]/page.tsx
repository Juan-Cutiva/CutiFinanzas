import { ArrowLeft, Wallet } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { getOrCreateUser } from '@/db/queries/users';
import { type AccountType, balanceDeltaFor, classifyAccount } from '@/features/accounts/domain';
import {
  getAccountById,
  getAccountTransactions,
  listAccountsByUser,
} from '@/features/accounts/queries';
import { ACCOUNT_TYPE_LABELS } from '@/features/accounts/schema';
import { listCategoriesByUser } from '@/features/categories/queries';
import { listDebtsByUser } from '@/features/debts/queries';
import { listSavingsGoals } from '@/features/savings/queries';
import { TransactionList } from '@/features/transactions/components/transaction-list';
import { formatAmount } from '@/lib/format';
import type { CurrencyCode } from '@/lib/money';

export const metadata: Metadata = { title: 'Detalle de cuenta' };
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AccountDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await getOrCreateUser();
  const account = await getAccountById(user.id as never, id);
  if (!account) notFound();

  const userId = user.id as never;
  const [txs, categories, accountsRaw, debtsRaw, goalsRaw] = await Promise.all([
    getAccountTransactions(userId, account.id),
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

  let balanceMinor = BigInt(account.initialBalanceMinor);
  for (const t of txs) {
    const isOrigin = t.accountId === account.id;
    balanceMinor += balanceDeltaFor(
      account.type as AccountType,
      t.kind,
      isOrigin,
      t.amountMinor as bigint,
    );
  }

  const balance = Number(balanceMinor) / 100;
  const positive = balance >= 0;
  const classification = classifyAccount(account.type as AccountType);
  const isLiability = classification === 'liability';

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
              <Wallet className="size-6" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-semibold tracking-tight md:text-2xl">{account.name}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <Badge variant="outline" className="font-normal">
                  {ACCOUNT_TYPE_LABELS[account.type as keyof typeof ACCOUNT_TYPE_LABELS]}
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
              {isLiability ? 'Deuda actual' : 'Saldo disponible'}
            </p>
            <p
              className={`font-mono tabular-nums text-3xl font-semibold tracking-tight ${
                isLiability
                  ? balance > 0
                    ? 'text-amount-negative'
                    : 'text-foreground'
                  : positive
                    ? 'text-amount-positive'
                    : 'text-amount-negative'
              }`}
            >
              {formatAmount(balance, account.currency as CurrencyCode)}
            </p>
            {isLiability && account.creditLimitMinor ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Cupo total{' '}
                {formatAmount(
                  Number(account.creditLimitMinor) / 100,
                  account.currency as CurrencyCode,
                )}{' '}
                · disponible{' '}
                {formatAmount(
                  Number(BigInt(account.creditLimitMinor) - balanceMinor) / 100,
                  account.currency as CurrencyCode,
                )}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Movimientos ({txs.length})
        </h3>
        {txs.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="Sin movimientos"
            description="Esta cuenta aún no tiene transacciones registradas."
          />
        ) : (
          <TransactionList
            items={txs as never}
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
