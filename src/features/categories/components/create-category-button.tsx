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
import { CategoryForm } from './category-form';

export function CreateCategoryButton() {
  const [open, setOpen] = useState(false);
  return (
    <ResponsiveDialog open={open} onOpenChange={setOpen}>
      <ResponsiveDialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" aria-hidden />
          Nueva categoría
        </Button>
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Nueva categoría</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Las categorías te ayudan a organizar tus gastos y presupuestos.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <div className="px-4 pb-6 md:px-0 md:pb-0">
          <CategoryForm onSuccess={() => setOpen(false)} />
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
