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
import { AccountForm } from './account-form';

export function CreateAccountButton({ defaultCurrency }: { defaultCurrency: string }) {
  const [open, setOpen] = useState(false);
  return (
    <ResponsiveDialog open={open} onOpenChange={setOpen}>
      <ResponsiveDialogTrigger asChild>
        <Button>
          <Plus className="size-4" aria-hidden />
          Nueva cuenta
        </Button>
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Crear cuenta</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Las cuentas agrupan tus movimientos por billetera, banco o tarjeta.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <div className="px-4 pb-6 md:px-0 md:pb-0">
          <AccountForm defaultCurrency={defaultCurrency} onSuccess={() => setOpen(false)} />
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
