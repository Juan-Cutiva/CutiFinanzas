import { ListOrdered } from 'lucide-react';
import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/empty-state';
import { getOrCreateUser } from '@/db/queries/users';
import { CloneMonthButton } from '@/features/transactions/components/clone-month-button';
import { TransactionList } from '@/features/transactions/components/transaction-list';
import { listTransactionsByMonth } from '@/features/transactions/queries';
import { dayjs } from '@/lib/format';

export const metadata: Metadata = { title: 'Transacciones' };
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ y?: string; m?: string }>;
}

export default async function TransaccionesPage({ searchParams }: PageProps) {
  const user = await getOrCreateUser();
  const params = await searchParams;
  const now = dayjs();
  const year = Number.parseInt(params.y ?? String(now.year()), 10);
  const month = Number.parseInt(params.m ?? String(now.month() + 1), 10);
  const monthLabel = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).format('MMMM YYYY');

  const items = await listTransactionsByMonth(user.id as never, year, month);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Transacciones</h2>
          <p className="text-sm text-muted-foreground">
            {monthLabel} — toca el botón ＋ para registrar.
          </p>
        </div>
        <CloneMonthButton />
      </header>

      {items.length === 0 ? (
        <EmptyState
          icon={ListOrdered}
          title="Aún no hay movimientos este mes"
          description="Toca el botón ＋ abajo a la derecha para registrar tu primer ingreso o gasto."
        />
      ) : (
        <TransactionList items={items} />
      )}
    </div>
  );
}
