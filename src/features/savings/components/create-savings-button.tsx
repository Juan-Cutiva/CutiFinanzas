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
import { SavingsGoalForm } from './savings-form';

export function CreateSavingsGoalButton({ defaultCurrency }: { defaultCurrency: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button>
          <Plus className="size-4" aria-hidden />
          Nueva meta
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Crear meta de ahorro</DrawerTitle>
          <DrawerDescription>
            Define un objetivo concreto y aporta cada mes para alcanzarlo.
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-6">
          <SavingsGoalForm defaultCurrency={defaultCurrency} onSuccess={() => setOpen(false)} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
