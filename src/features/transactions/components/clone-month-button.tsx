'use client';

import { Copy } from 'lucide-react';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { dayjs } from '@/lib/format';
import { cloneMonthAction } from '../clone-month';

export function CloneMonthButton() {
  const [open, setOpen] = useState(false);
  const now = dayjs();
  const previous = now.subtract(1, 'month');

  const { execute, isPending } = useAction(cloneMonthAction, {
    onSuccess: ({ data }) => {
      toast.success(`${data?.cloned ?? 0} transacciones clonadas del mes anterior`);
      setOpen(false);
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Error'),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Copy className="size-4" aria-hidden />
          Clonar mes anterior
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clonar de {previous.format('MMMM YYYY')}</DialogTitle>
          <DialogDescription>
            Copia los ingresos y gastos <strong>fijos</strong> del mes pasado a{' '}
            {now.format('MMMM YYYY')} (saldrán como “no pagados”).
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            disabled={isPending}
            onClick={() =>
              execute({
                sourceYear: previous.year(),
                sourceMonth: previous.month() + 1,
                targetYear: now.year(),
                targetMonth: now.month() + 1,
                onlyFixed: true,
              })
            }
          >
            {isPending ? 'Clonando…' : 'Clonar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
