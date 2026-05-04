'use client';

import { CreditCard, Eye, Pencil, Trash2 } from 'lucide-react';
import { useAction } from 'next-safe-action/hooks';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MoneyInput } from '@/components/ui/money-input';
import { formatAmount, formatDate } from '@/lib/format';
import type { CurrencyCode } from '@/lib/money';
import { deleteDebtUsageAction, updateDebtUsageAction } from '../actions';

export interface DebtUsageItem {
  id: string;
  amountMinor: bigint;
  currency: string;
  description: string;
  occurredAt: string;
}

interface Props {
  items: DebtUsageItem[];
}

export function DebtUsagesList({ items }: Props) {
  const [editing, setEditing] = React.useState<DebtUsageItem | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<DebtUsageItem | null>(null);
  const [viewing, setViewing] = React.useState<DebtUsageItem | null>(null);

  const [editAmount, setEditAmount] = React.useState<number>(0);
  const [editDescription, setEditDescription] = React.useState('');

  React.useEffect(() => {
    if (!editing) return;
    setEditAmount(Number(editing.amountMinor) / 100);
    setEditDescription(editing.description);
  }, [editing]);

  const updateAction = useAction(updateDebtUsageAction, {
    onSuccess: () => {
      toast.success('Aumento actualizado');
      setEditing(null);
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? 'No se pudo actualizar');
    },
  });

  const deleteAction = useAction(deleteDebtUsageAction, {
    onSuccess: () => {
      toast.success('Aumento eliminado');
      setPendingDelete(null);
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? 'No se pudo eliminar');
    },
  });

  return (
    <>
      <Card>
        <ul className="divide-y divide-border">
          {items.map((u) => {
            const amountMajor = Number(u.amountMinor) / 100;
            return (
              <li key={u.id} className="group flex items-center gap-3 px-4 py-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-full bg-amount-negative/15 text-amount-negative">
                  <CreditCard className="size-4" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{u.description}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDate(u.occurredAt, 'D [de] MMMM YYYY')}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-mono tabular-nums text-sm font-semibold text-amount-negative">
                    {formatAmount(amountMajor, u.currency as CurrencyCode, {
                      signDisplay: 'always',
                    })}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Ver detalles"
                    className="size-9 transition-opacity md:size-8 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                    onClick={() => setViewing(u)}
                  >
                    <Eye className="size-4 text-muted-foreground" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Editar aumento"
                    className="size-9 transition-opacity md:size-8 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                    onClick={() => setEditing(u)}
                  >
                    <Pencil className="size-4 text-muted-foreground" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Eliminar aumento"
                    className="size-9 transition-opacity md:size-8 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                    onClick={() => setPendingDelete(u)}
                  >
                    <Trash2 className="size-4 text-muted-foreground" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar aumento de saldo</DialogTitle>
            <DialogDescription>
              Si cambias el monto, el saldo de la deuda se ajustará automáticamente por la
              diferencia.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div>
              <Label htmlFor="edit-usage-amount">Monto</Label>
              <MoneyInput
                id="edit-usage-amount"
                className="mt-1.5 font-mono tabular-nums text-lg"
                value={editAmount}
                onChange={(v) => setEditAmount(typeof v === 'number' ? v : 0)}
              />
            </div>
            <div>
              <Label htmlFor="edit-usage-desc">Motivo</Label>
              <Input
                id="edit-usage-desc"
                className="mt-1.5"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                maxLength={200}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() =>
                editing &&
                updateAction.execute({
                  eventId: editing.id,
                  amount: editAmount,
                  description: editDescription.trim(),
                })
              }
              disabled={
                updateAction.isPending || editAmount <= 0 || editDescription.trim().length === 0
              }
            >
              {updateAction.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar este aumento?</DialogTitle>
            <DialogDescription>
              {pendingDelete?.description}. Al eliminarlo, el monto se restará tanto del saldo
              actual como del monto inicial de la deuda.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={deleteAction.isPending}
              onClick={() => pendingDelete && deleteAction.execute({ eventId: pendingDelete.id })}
            >
              {deleteAction.isPending ? 'Eliminando…' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="truncate">{viewing?.description}</DialogTitle>
            <DialogDescription>
              {viewing ? formatDate(viewing.occurredAt, 'D [de] MMMM YYYY') : ''} · Aumento de saldo
            </DialogDescription>
          </DialogHeader>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Monto</p>
            <p className="font-mono tabular-nums text-3xl font-semibold tracking-tight text-amount-negative">
              {viewing
                ? formatAmount(
                    Number(viewing.amountMinor) / 100,
                    viewing.currency as CurrencyCode,
                    { signDisplay: 'always' },
                  )
                : ''}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewing(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
