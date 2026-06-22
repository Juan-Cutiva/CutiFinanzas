'use client';

import { useAction } from 'next-safe-action/hooks';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MoneyInput } from '@/components/ui/money-input';
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
import { Textarea } from '@/components/ui/textarea';
import { dayjs } from '@/lib/format';
import { updateRecurringBudgetAction } from '../actions';

export interface EditableBudget {
  id: string;
  categoryName: string;
  amountMinor: bigint;
  currency: string;
  year: number;
  month: number;
  notes: string | null;
}

interface Props {
  budget: EditableBudget | null;
  onClose: () => void;
}

export function EditBudgetDialog({ budget, onClose }: Props) {
  const [amount, setAmount] = React.useState<number>(0);
  const [notes, setNotes] = React.useState('');
  const [mode, setMode] = React.useState<'this_month' | 'forward'>('forward');

  React.useEffect(() => {
    if (!budget) return;
    setAmount(Number(budget.amountMinor) / 100);
    setNotes(budget.notes ?? '');
    setMode('forward');
  }, [budget]);

  const update = useAction(updateRecurringBudgetAction, {
    onSuccess: () => {
      toast.success(
        mode === 'forward'
          ? 'Presupuesto actualizado desde este mes en adelante'
          : 'Presupuesto actualizado solo este mes',
      );
      onClose();
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? 'No se pudo actualizar');
    },
  });

  if (!budget) return null;

  function submit() {
    if (!budget) return;
    update.execute({
      id: budget.id,
      amount,
      notes: notes.trim() || null,
      mode,
    });
  }

  const monthLabel = dayjs(`${budget.year}-${String(budget.month).padStart(2, '0')}-01`).format(
    'MMMM YYYY',
  );

  return (
    <ResponsiveDialog open={!!budget} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Editar presupuesto</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {budget.categoryName} · {monthLabel}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody>
          <div className="flex flex-col gap-4">
            <div>
              <Label htmlFor="edit-budget-amount">Monto asignado</Label>
              <MoneyInput
                id="edit-budget-amount"
                className="mt-1.5 font-mono tabular-nums text-lg"
                value={amount}
                onChange={(v) => setAmount(typeof v === 'number' ? v : 0)}
              />
            </div>

            <div>
              <Label htmlFor="edit-budget-notes">Notas (opcional)</Label>
              <Textarea
                id="edit-budget-notes"
                className="mt-1.5"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <fieldset className="rounded-md border border-border/60 bg-muted/30 p-3">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Alcance del cambio
              </legend>
              <div className="flex flex-col gap-2">
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="edit-budget-mode"
                    value="this_month"
                    checked={mode === 'this_month'}
                    onChange={() => setMode('this_month')}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium">Solo este mes</span>
                    <span className="block text-xs text-muted-foreground">
                      El cambio aplica solo a {monthLabel}. Los demás meses siguen con el monto
                      actual del presupuesto recurrente.
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="edit-budget-mode"
                    value="forward"
                    checked={mode === 'forward'}
                    onChange={() => setMode('forward')}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium">Desde este mes en adelante</span>
                    <span className="block text-xs text-muted-foreground">
                      Los meses pasados conservan su valor original. Desde {monthLabel} en adelante
                      se usa el nuevo monto.
                    </span>
                  </span>
                </label>
              </div>
            </fieldset>
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={update.isPending || amount < 0}>
              {update.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </ResponsiveDialogBody>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
