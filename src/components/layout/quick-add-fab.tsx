'use client';

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function QuickAddFAB() {
  return (
    <Button
      type="button"
      size="fab"
      aria-label="Agregar transacción rápida"
      className="fixed right-4 z-40 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-6"
    >
      <Plus className="size-6" aria-hidden />
    </Button>
  );
}
