'use client';

import { useAction } from 'next-safe-action/hooks';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { KIND_LABELS, type TransactionKind } from '@/lib/accounting/shared';
import { editVirtualAction, updateRecurringAction, updateTransactionAction } from '../actions';

export interface EditableTx {
  /** Para virtuales: `virtual:<ruleId>:<YYYY-MM-DD>`. Para reales: id de transacción. */
  id: string;
  kind: TransactionKind;
  amountMinor: bigint;
  currency: string;
  transactionDate: string;
  description: string | null;
  notes: string | null;
  categoryId: string | null;
  recurringRuleId: string | null;
  /** True si la transacción aún no está materializada (es proyectada). */
  isVirtual?: boolean;
}

export interface CategoryOption {
  id: string;
  name: string;
}

interface Props {
  tx: EditableTx | null;
  categories: CategoryOption[];
  onClose: () => void;
}

const NONE_CATEGORY = '__none__';

export function EditTransactionDialog({ tx, categories, onClose }: Props) {
  const [amount, setAmount] = React.useState<number | undefined>(undefined);
  const [transactionDate, setTransactionDate] = React.useState<string>('');
  const [description, setDescription] = React.useState<string>('');
  const [notes, setNotes] = React.useState<string>('');
  const [categoryId, setCategoryId] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<'this_one' | 'forward'>('forward');

  React.useEffect(() => {
    if (!tx) return;
    setAmount(Number(tx.amountMinor) / 100);
    setTransactionDate(tx.transactionDate);
    setDescription(tx.description ?? '');
    setNotes(tx.notes ?? '');
    setCategoryId(tx.categoryId);
    // Virtual o recurrente: default this_one (cambio solo este mes); puntual: this_one.
    setMode('this_one');
  }, [tx]);

  const updateOnce = useAction(updateTransactionAction, {
    onSuccess: () => {
      toast.success('Movimiento actualizado');
      onClose();
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'No se pudo actualizar'),
  });

  const updateRec = useAction(updateRecurringAction, {
    onSuccess: () => {
      toast.success(
        mode === 'forward' ? 'Actualizado de aquí en adelante' : 'Solo este movimiento actualizado',
      );
      onClose();
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'No se pudo actualizar'),
  });

  const editVirt = useAction(editVirtualAction, {
    onSuccess: () => {
      toast.success(
        mode === 'forward'
          ? 'Recurrente actualizada de aquí en adelante'
          : 'Solo esta ocurrencia actualizada',
      );
      onClose();
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'No se pudo actualizar'),
  });

  const isPending = updateOnce.isPending || updateRec.isPending || editVirt.isPending;
  const isVirtual = tx?.isVirtual === true;
  const isRecurring = !!tx?.recurringRuleId;
  // Categoría aplica a expense, cc_charge, cc_payment, income, refund, loan_payment
  // (todos excepto transfer y savings_contribution).
  const supportsCategory = tx && tx.kind !== 'transfer' && tx.kind !== 'savings_contribution';

  function submit() {
    if (!tx) return;
    if (isVirtual) {
      // Parsear `virtual:<ruleId>:<YYYY-MM-DD>` para llamar editVirtualAction.
      const parts = tx.id.split(':');
      const ruleId = parts[1];
      const occurrenceDate = parts[2];
      if (!ruleId || !occurrenceDate) return;
      editVirt.execute({
        ruleId,
        occurrenceDate,
        amount,
        description: description.trim() || null,
        notes: notes.trim() || null,
        categoryId,
        mode,
      });
    } else if (isRecurring) {
      updateRec.execute({
        transactionId: tx.id,
        amount,
        description: description.trim() || null,
        notes: notes.trim() || null,
        categoryId,
        mode,
      });
    } else {
      updateOnce.execute({
        id: tx.id,
        amount,
        transactionDate,
        description: description.trim() || null,
        notes: notes.trim() || null,
        categoryId,
      });
    }
  }

  return (
    <ResponsiveDialog open={!!tx} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Editar movimiento</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {tx ? KIND_LABELS[tx.kind] : ''}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        {tx ? (
          <ResponsiveDialogBody>
            <div className="grid gap-2">
              <Label htmlFor="edit-amount">Monto</Label>
              <MoneyInput
                id="edit-amount"
                className="font-mono tabular-nums text-lg"
                value={amount}
                onChange={setAmount}
              />
            </div>

            {!isRecurring && !isVirtual ? (
              <div className="grid gap-2">
                <Label htmlFor="edit-date">Fecha</Label>
                <DatePicker value={transactionDate} onChange={setTransactionDate} />
              </div>
            ) : null}

            {supportsCategory ? (
              <div className="grid gap-2">
                <Label htmlFor="edit-category">Categoría</Label>
                <Select
                  value={categoryId ?? NONE_CATEGORY}
                  onValueChange={(v) => setCategoryId(v === NONE_CATEGORY ? null : v)}
                >
                  <SelectTrigger id="edit-category">
                    <SelectValue placeholder="Selecciona categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_CATEGORY}>— Sin categoría —</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="grid gap-2">
              <Label htmlFor="edit-desc">Descripción</Label>
              <Input
                id="edit-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-notes">Notas (opcional)</Label>
              <Textarea
                id="edit-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {isRecurring || isVirtual ? (
              <fieldset className="rounded-md border border-border/60 bg-muted/30 p-3">
                <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Alcance del cambio
                </legend>
                <div className="flex flex-col gap-2">
                  <label className="flex cursor-pointer items-start gap-2 text-sm">
                    <input
                      type="radio"
                      name="edit-mode"
                      value="this_one"
                      checked={mode === 'this_one'}
                      onChange={() => setMode('this_one')}
                      className="mt-1"
                    />
                    <span>
                      <span className="font-medium">Solo este mes</span>
                      <span className="block text-xs text-muted-foreground">
                        {isVirtual
                          ? 'Aplica el cambio solo a esta ocurrencia futura. Los demás meses conservan los valores de la regla.'
                          : 'Aplica solo a esta ocurrencia. Las demás conservan su valor.'}
                      </span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-2 text-sm">
                    <input
                      type="radio"
                      name="edit-mode"
                      value="forward"
                      checked={mode === 'forward'}
                      onChange={() => setMode('forward')}
                      className="mt-1"
                    />
                    <span>
                      <span className="font-medium">De este mes en adelante</span>
                      <span className="block text-xs text-muted-foreground">
                        Crea una nueva regla desde este mes. Los meses anteriores quedan intactos.
                      </span>
                    </span>
                  </label>
                </div>
              </fieldset>
            ) : null}

            <div className="mt-2 flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button onClick={submit} disabled={isPending || !amount}>
                {isPending ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          </ResponsiveDialogBody>
        ) : null}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
