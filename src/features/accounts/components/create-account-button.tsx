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
import { AccountForm } from './account-form';

export function CreateAccountButton({ defaultCurrency }: { defaultCurrency: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button>
          <Plus className="size-4" aria-hidden />
          Nueva cuenta
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Crear cuenta</DrawerTitle>
          <DrawerDescription>
            Las cuentas agrupan tus movimientos por billetera, banco o tarjeta.
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-6">
          <AccountForm defaultCurrency={defaultCurrency} onSuccess={() => setOpen(false)} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
