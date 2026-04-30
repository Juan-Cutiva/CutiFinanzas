'use client';

import { Sparkles } from 'lucide-react';
import { useAction } from 'next-safe-action/hooks';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { seedDefaultCategoriesAction } from '../actions';

export function SeedDefaultCategoriesButton() {
  const { execute, isPending } = useAction(seedDefaultCategoriesAction, {
    onSuccess: ({ data }) => {
      const created = Array.isArray(data) ? data.length : 0;
      if (created === 0) toast.info('Ya tienes categorías creadas');
      else toast.success(`${created} categorías creadas`);
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? 'No se pudo crear las categorías');
    },
  });

  return (
    <Button onClick={() => execute({})} disabled={isPending} variant="default" size="sm">
      <Sparkles className="size-4" aria-hidden />
      {isPending ? 'Creando…' : 'Crear categorías por defecto'}
    </Button>
  );
}
