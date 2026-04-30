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
import { DebtForm } from './debt-form';

export function CreateDebtButton({ defaultCurrency }: { defaultCurrency: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button>
          <Plus className="size-4" aria-hidden />
          Nueva deuda
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Registrar deuda</DrawerTitle>
          <DrawerDescription>
            Lleva el control de saldo, interés y cuotas restantes.
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-6">
          <DebtForm defaultCurrency={defaultCurrency} onSuccess={() => setOpen(false)} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
