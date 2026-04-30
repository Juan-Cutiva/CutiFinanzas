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
import { CategoryForm } from './category-form';

export function CreateCategoryButton() {
  const [open, setOpen] = useState(false);
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" aria-hidden />
          Nueva categoría
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Nueva categoría</DrawerTitle>
          <DrawerDescription>
            Las categorías te ayudan a organizar tus gastos y presupuestos.
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-6">
          <CategoryForm onSuccess={() => setOpen(false)} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
