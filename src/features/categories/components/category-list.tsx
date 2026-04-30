'use client';

import { Trash2 } from 'lucide-react';
import { useAction } from 'next-safe-action/hooks';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { archiveCategoryAction } from '../actions';

export interface CategoryItem {
  id: string;
  name: string;
  color: string;
}

export function CategoryList({ items }: { items: CategoryItem[] }) {
  const [pending, setPending] = useState<CategoryItem | null>(null);

  const { execute, isPending } = useAction(archiveCategoryAction, {
    onSuccess: () => {
      toast.success('Categoría archivada');
      setPending(null);
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Error'),
  });

  return (
    <>
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((c) => (
          <li
            key={c.id}
            className="group flex items-center gap-3 rounded-md border border-border/60 bg-muted/30 px-3 py-2"
          >
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: c.color }}
              aria-hidden
            />
            <span className="flex-1 truncate text-sm">{c.name}</span>
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Archivar ${c.name}`}
              className="size-7 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              onClick={() => setPending(c)}
            >
              <Trash2 className="size-3.5 text-muted-foreground" />
            </Button>
          </li>
        ))}
      </ul>

      <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Archivar esta categoría?</DialogTitle>
            <DialogDescription>
              {pending?.name} dejará de aparecer en listas, pero los movimientos existentes la
              conservarán como referencia.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() => pending && execute({ id: pending.id })}
            >
              {isPending ? 'Archivando…' : 'Archivar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
