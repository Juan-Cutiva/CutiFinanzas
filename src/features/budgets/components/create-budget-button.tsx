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
  ResponsiveDialogTrigger,
} from '@/components/ui/responsive-dialog';
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
    <ResponsiveDialog open={open} onOpenChange={setOpen}>
      <ResponsiveDialogTrigger asChild>
        <Button>
          <Plus className="size-4" aria-hidden />
          Nuevo presupuesto
        </Button>
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Asignar presupuesto</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Define cuánto puedes gastar en una categoría este mes.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <div className="px-4 pb-6 md:px-0 md:pb-0">
          <BudgetForm
            categories={categories}
            year={year}
            month={month}
            defaultCurrency={defaultCurrency}
            onSuccess={() => setOpen(false)}
          />
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
