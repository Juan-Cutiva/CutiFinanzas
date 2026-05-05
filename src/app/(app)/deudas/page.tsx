import { CreditCard } from 'lucide-react';
import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/empty-state';
import { getOrCreateUser } from '@/db/queries/users';
import { CreateDebtButton } from '@/features/debts/components/create-debt-button';
import { DebtList } from '@/features/debts/components/debt-list';
import { listDebtsWithBalanceAsOf } from '@/features/debts/queries';
import { dayjs, nowInTz } from '@/lib/format';

export const metadata: Metadata = { title: 'Deudas' };
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ y?: string; m?: string }>;
}

export default async function DeudasPage({ searchParams }: PageProps) {
  const user = await getOrCreateUser();
  const params = await searchParams;
  const now = nowInTz(user.timezone);
  const year = Number.parseInt(params.y ?? String(now.year()), 10);
  const month = Number.parseInt(params.m ?? String(now.month() + 1), 10);
  const lastDay = new Date(year, month, 0).getDate();
  const asOfIso = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const monthLabel = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).format('MMMM YYYY');

  const debts = await listDebtsWithBalanceAsOf(user.id as never, asOfIso);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Deudas</h2>
          <p className="text-sm text-muted-foreground">
            Saldo proyectado al cierre de {monthLabel}.
          </p>
        </div>
        <CreateDebtButton defaultCurrency={user.defaultCurrency} />
      </header>

      {debts.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="Sin deudas registradas"
          description="¡Excelente! Si más adelante adquieres una, podrás registrarla aquí."
        />
      ) : (
        <DebtList items={debts} />
      )}
    </div>
  );
}
