'use client';

import { Plus } from 'lucide-react';
import { useAction } from 'next-safe-action/hooks';
import * as React from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MoneyInput } from '@/components/ui/money-input';
import { recordDebtUsageAction } from '../actions';

interface Props {
  debtId: string;
  debtName: string;
}

export function RecordDebtUsageButton({ debtId, debtName }: Props) {
  const [open, setOpen] = React.useState(false);
  const [amount, setAmount] = React.useState<number>(0);
  const [description, setDescription] = React.useState('');

  const { execute, isPending } = useAction(recordDebtUsageAction, {
    onSuccess: () => {
      toast.success('Uso registrado en la deuda');
      setOpen(false);
      setAmount(0);
      setDescription('');
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? 'No se pudo registrar el uso');
    },
  });

  const canSubmit = amount > 0 && description.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="size-4" aria-hidden /> Registrar uso
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar uso adicional</DialogTitle>
          <DialogDescription>
            Aumenta el saldo de {debtName} sin afectar tus cuentas. Útil para una compra a cuotas
            extra, mora capitalizada o refinanciación.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="usage-amount">Monto</Label>
            <MoneyInput
              id="usage-amount"
              className="mt-1.5 font-mono tabular-nums text-lg"
              value={amount}
              onChange={(v) => setAmount(typeof v === 'number' ? v : 0)}
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="usage-desc">Motivo</Label>
            <Input
              id="usage-desc"
              className="mt-1.5"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej. compra adicional, intereses moratorios, refinanciación…"
              maxLength={200}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => execute({ id: debtId, amount, description: description.trim() })}
            disabled={isPending || !canSubmit}
          >
            {isPending ? 'Guardando…' : 'Registrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
