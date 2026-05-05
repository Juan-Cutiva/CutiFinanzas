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
import { SavingsGoalForm } from './savings-form';

export function CreateSavingsGoalButton({ defaultCurrency }: { defaultCurrency: string }) {
  const [open, setOpen] = useState(false);
  return (
    <ResponsiveDialog open={open} onOpenChange={setOpen}>
      <ResponsiveDialogTrigger asChild>
        <Button>
          <Plus className="size-4" aria-hidden />
          Nueva meta
        </Button>
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Crear meta de ahorro</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Define un objetivo y aporta con movimientos tipo "Aporte a meta de ahorro".
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <div className="px-4 pb-6 md:px-0 md:pb-0">
          <SavingsGoalForm defaultCurrency={defaultCurrency} onSuccess={() => setOpen(false)} />
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
