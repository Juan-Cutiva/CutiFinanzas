'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { TransactionForm } from './transaction-form';

interface AccountOption {
  id: string;
  name: string;
  currency: string;
  type: string;
}

interface CategoryOption {
  id: string;
  name: string;
}

interface DebtOption {
  id: string;
  name: string;
  currency: string;
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
}

export function QuickAddDrawer({
  accounts,
  categories,
  debts,
  savingsGoals,
  defaultCurrency,
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

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Nuevo movimiento</DrawerTitle>
            <DrawerDescription>Registra un ingreso, gasto, transferencia o pago.</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6">
            <TransactionForm
              accounts={accounts}
              categories={categories}
              debts={debts}
              savingsGoals={savingsGoals}
              defaultCurrency={defaultCurrency}
              onSuccess={() => setOpen(false)}
            />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
