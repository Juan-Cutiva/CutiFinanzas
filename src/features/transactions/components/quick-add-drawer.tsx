'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
import { TransactionForm } from './transaction-form';

interface AccountOption {
  id: string;
  name: string;
  currency: string;
  type: string;
  realMinor?: string;
  projectedMinor?: string;
  creditLimitMinor?: string | null;
}
interface CategoryOption {
  id: string;
  name: string;
}
interface DebtOption {
  id: string;
  name: string;
  currency: string;
  realBalanceMinor?: string;
}
interface SavingsOption {
  id: string;
  name: string;
  currency: string;
}

interface Props {
  accounts: AccountOption[];
  categories: CategoryOption[];
  debts: DebtOption[];
  savingsGoals: SavingsOption[];
  defaultCurrency: string;
  defaultDate?: string;
}

export function QuickAddDrawer({
  accounts,
  categories,
  debts,
  savingsGoals,
  defaultCurrency,
  defaultDate,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        size="fab"
        aria-label="Agregar transacción rápida"
        onClick={() => setOpen(true)}
        className="fixed right-4 z-40 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-6"
      >
        <Plus className="size-6" aria-hidden />
      </Button>

      <ResponsiveDialog open={open} onOpenChange={setOpen}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Nuevo movimiento</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Registra un ingreso, gasto, transferencia o pago.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="px-4 pb-6 pt-2 md:px-0 md:pb-0">
            <TransactionForm
              accounts={accounts}
              categories={categories}
              debts={debts}
              savingsGoals={savingsGoals}
              defaultCurrency={defaultCurrency}
              defaultDate={defaultDate}
              onSuccess={() => setOpen(false)}
            />
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}
