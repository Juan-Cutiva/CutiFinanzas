import { TrendingDown } from 'lucide-react';
import type { Metadata } from 'next';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { getOrCreateUser } from '@/db/queries/users';
import { listCategoriesByUser } from '@/features/categories/queries';
import {
  TransactionList,
  type TxListItem,
} from '@/features/transactions/components/transaction-list';
import { listExpenseByMonth } from '@/features/transactions/queries';
import { listVirtualsForMonth } from '@/lib/accounting';
import { EXPENSE_KINDS, type TransactionKind } from '@/lib/accounting/shared';
import { formatAmount, formatMonthYear, nowInTz } from '@/lib/format';
import type { CurrencyCode } from '@/lib/money';
import type { UserId } from '@/types/ids';

export const metadata: Metadata = { title: 'Gastos' };
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ y?: string; m?: string }>;
}

export default async function GastosPage({ searchParams }: PageProps) {
  const user = await getOrCreateUser();
  const userId = user.id as UserId;
  const currency = user.defaultCurrency as CurrencyCode;
  const params = await searchParams;
  const now = nowInTz(user.timezone);
  const year = Number.parseInt(params.y ?? String(now.year()), 10);
  const month = Number.parseInt(params.m ?? String(now.month() + 1), 10);
  const monthLabel = formatMonthYear(`${year}-${String(month).padStart(2, '0')}-01`);

  const [items, allVirtuals, categories] = await Promise.all([
    listExpenseByMonth(userId, year, month),
    listVirtualsForMonth(userId, year, month),
    listCategoriesByUser(userId),
  ]);
  const expenseKindsSet = new Set<TransactionKind>(EXPENSE_KINDS);
  const virtuals = allVirtuals.filter((v) => expenseKindsSet.has(v.kind));

  const recurring = items.filter((t) => t.recurringRuleId);
  const confirmedCount = recurring.filter((t) => t.isPaid).length;
  const recurringTotal = recurring.length + virtuals.length;
  const fijosMinor =
    recurring.reduce((acc, t) => acc + Number(t.amountMinor), 0) +
    virtuals.reduce((acc, v) => acc + Number(v.amountMinor), 0);
  const variablesMinor = items
    .filter((t) => !t.recurringRuleId)
    .reduce((acc, t) => acc + Number(t.amountMinor), 0);
  const totalMinor = fijosMinor + variablesMinor;

  const realItems: TxListItem[] = items.map((t) => ({
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
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Gastos</h2>
          <p className="text-sm text-muted-foreground">
            {monthLabel} — incluye gastos en efectivo, pagos a tarjeta y cuotas de préstamos. Las
            compras con tarjeta de crédito viven en su propia cuenta y se cuentan al pagar.
          </p>
        </div>
        {recurringTotal > 0 ? (
          <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Confirmados
            </p>
            <p className="font-mono tabular-nums text-sm font-semibold">
              {confirmedCount}/{recurringTotal}
            </p>
          </div>
        ) : null}
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Total" value={formatAmount(totalMinor / 100, currency)} />
        <SummaryCard label="Recurrentes" value={formatAmount(fijosMinor / 100, currency)} />
        <SummaryCard label="Puntuales" value={formatAmount(variablesMinor / 100, currency)} />
      </section>

      {itemsForList.length === 0 ? (
        <EmptyState
          icon={TrendingDown}
          title="Sin gastos este mes"
          description="Toca el botón ＋ para registrar un gasto."
        />
      ) : (
        <TransactionList
          items={itemsForList}
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 font-mono tabular-nums text-xl font-semibold text-amount-negative">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
