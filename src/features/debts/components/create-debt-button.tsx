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
import { DebtForm } from './debt-form';

export function CreateDebtButton({ defaultCurrency }: { defaultCurrency: string }) {
  const [open, setOpen] = useState(false);
  return (
    <ResponsiveDialog open={open} onOpenChange={setOpen}>
      <ResponsiveDialogTrigger asChild>
        <Button>
          <Plus className="size-4" aria-hidden />
          Nueva deuda
        </Button>
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Registrar préstamo</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Lleva el control del capital, interés y cuotas restantes.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <div className="px-4 pb-6 md:px-0 md:pb-0">
          <DebtForm defaultCurrency={defaultCurrency} onSuccess={() => setOpen(false)} />
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
