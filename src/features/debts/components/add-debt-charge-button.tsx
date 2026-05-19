'use client';

import { Receipt } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
import { TransactionForm } from '@/features/transactions/components/transaction-form';

interface AccountOption {
  id: string;
  name: string;
  currency: string;
  type: string;
  realMinor?: string;
  projectedMinor?: string;
  creditLimitMinor?: string | null;
}
interface DebtOption {
  id: string;
  name: string;
  currency: string;
  realBalanceMinor?: string;
}

interface Props {
  accounts: AccountOption[];
  debts: DebtOption[];
  defaultCurrency: string;
  defaultDate?: string;
}

/**
 * Botón "Agregar cargo a la deuda" — abre un drawer/dialog con el form de
 * transacción pre-seleccionado en kind=loan_charge. Usado en `/deudas/[id]`.
 */
export function AddDebtChargeButton({ accounts, debts, defaultCurrency, defaultDate }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <Receipt className="size-4" aria-hidden />
        Agregar cargo
      </Button>

      <ResponsiveDialog open={open} onOpenChange={setOpen}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Cargo a la deuda</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Intereses capitalizados, multas, ajustes o desembolso adicional. Aumenta el saldo del
              préstamo.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="px-4 pb-6 pt-2 md:px-0 md:pb-0">
            <TransactionForm
              accounts={accounts}
              categories={[]}
              debts={debts}
              savingsGoals={[]}
              defaultCurrency={defaultCurrency}
              defaultDate={defaultDate}
              defaultKind="loan_charge"
              onSuccess={() => setOpen(false)}
            />
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}
