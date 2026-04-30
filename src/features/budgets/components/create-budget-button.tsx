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
  DrawerTrigger,
} from '@/components/ui/drawer';
import { BudgetForm } from './budget-form';

interface Props {
  categories: Array<{ id: string; name: string }>;
  year: number;
  month: number;
  defaultCurrency: string;
}

export function CreateBudgetButton({ categories, year, month, defaultCurrency }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button>
          <Plus className="size-4" aria-hidden />
          Nuevo presupuesto
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Asignar presupuesto</DrawerTitle>
          <DrawerDescription>
            Define cuánto puedes gastar en una categoría este mes.
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-6">
          <BudgetForm
            categories={categories}
            year={year}
            month={month}
            defaultCurrency={defaultCurrency}
            onSuccess={() => setOpen(false)}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
