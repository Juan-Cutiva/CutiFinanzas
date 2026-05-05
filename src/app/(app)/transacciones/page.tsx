import { ListOrdered } from 'lucide-react';
import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/empty-state';
import { getOrCreateUser } from '@/db/queries/users';
import {
  TransactionList,
  type TxListItem,
} from '@/features/transactions/components/transaction-list';
import { listTransactionsByMonth } from '@/features/transactions/queries';
import type { TransactionKind } from '@/lib/accounting/shared';
import { dayjs, nowInTz } from '@/lib/format';
import type { UserId } from '@/types/ids';

export const metadata: Metadata = { title: 'Transacciones' };
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ y?: string; m?: string }>;
}

export default async function TransaccionesPage({ searchParams }: PageProps) {
  const user = await getOrCreateUser();
  const params = await searchParams;
  const now = nowInTz(user.timezone);
  const year = Number.parseInt(params.y ?? String(now.year()), 10);
  const month = Number.parseInt(params.m ?? String(now.month() + 1), 10);
  const monthLabel = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).format('MMMM YYYY');

  const userId = user.id as UserId;
  const items = await listTransactionsByMonth(userId, year, month);

  const itemsForList: TxListItem[] = items.map((t) => ({
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
    savingsGoal: t.savingsGoal ? { name: t.savingsGoal.name } : null,
  }));

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Transacciones</h2>
          <p className="text-sm text-muted-foreground">
            {monthLabel} — toca el botón ＋ para registrar.
          </p>
        </div>
      </header>

      {itemsForList.length === 0 ? (
        <EmptyState
          icon={ListOrdered}
          title="Aún no hay movimientos este mes"
          description="Toca el botón ＋ abajo a la derecha para registrar tu primer ingreso o gasto."
        />
      ) : (
        <TransactionList items={itemsForList} />
      )}
    </div>
  );
}
