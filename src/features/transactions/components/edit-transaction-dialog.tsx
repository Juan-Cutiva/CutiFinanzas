'use client';

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
} from '@/components/ui/dialog';
import { FileUpload } from '@/components/ui/file-upload';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MoneyInput } from '@/components/ui/money-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatDate } from '@/lib/format';
import { updateRecurringTransactionAction, updateTransactionAction } from '../actions';

export interface CategoryOption {
  id: string;
  name: string;
}

export interface EditableTx {
  id: string;
  kind: string;
  amountMinor: bigint;
  currency: string;
  occurredAt: string;
  description: string | null;
  notes: string | null;
  categoryId: string | null;
  receiptUrl: string | null;
  isRecurring: boolean;
}

interface Props {
  tx: EditableTx | null;
  categories: CategoryOption[];
  onClose: () => void;
}

const CATEGORY_KINDS = new Set(['expense_fixed', 'expense_variable', 'credit_card_payment']);

const CATEGORY_REQUIRED_KINDS = new Set(['expense_fixed', 'expense_variable']);

const RECEIPT_KINDS = new Set([
  'expense_fixed',
  'expense_variable',
  'credit_card_payment',
  'debt_payment',
  'income_fixed',
  'income_variable',
  'refund',
]);

export function EditTransactionDialog({ tx, categories, onClose }: Props) {
  const [amount, setAmount] = React.useState<number>(0);
  const [description, setDescription] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [categoryId, setCategoryId] = React.useState<string | null>(null);
  const [receiptUrl, setReceiptUrl] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<'this_month' | 'forward'>('this_month');

  React.useEffect(() => {
    if (!tx) return;
    setAmount(Number(tx.amountMinor) / 100);
    setDescription(tx.description ?? '');
    setNotes(tx.notes ?? '');
    setCategoryId(tx.categoryId ?? null);
    setReceiptUrl(tx.receiptUrl ?? null);
    setMode('this_month');
  }, [tx]);

  const updateOnce = useAction(updateTransactionAction, {
    onSuccess: () => {
      toast.success('Movimiento actualizado');
      onClose();
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? 'No se pudo actualizar');
    },
  });

  const updateRecurring = useAction(updateRecurringTransactionAction, {
    onSuccess: () => {
      toast.success(
        mode === 'forward' ? 'Actualizado desde este mes en adelante' : 'Actualizado solo este mes',
      );
      onClose();
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? 'No se pudo actualizar');
    },
  });

  if (!tx) return null;

  const showCategory = CATEGORY_KINDS.has(tx.kind);
  const categoryRequired = CATEGORY_REQUIRED_KINDS.has(tx.kind);
  const isPending = updateOnce.isPending || updateRecurring.isPending;
  const canSubmit = amount > 0 && (!categoryRequired || (categoryId !== null && categoryId !== ''));

  const showReceipt = RECEIPT_KINDS.has(tx.kind) && (!tx.isRecurring || mode === 'this_month');

  function submit() {
    if (!tx) return;
    if (tx.isRecurring) {
      updateRecurring.execute({
        id: tx.id,
        amount,
        description: description.trim() || undefined,
        notes: notes.trim() || null,
        categoryId,
        receiptUrl: mode === 'this_month' ? receiptUrl : undefined,
        mode,
      });
    } else {
      updateOnce.execute({
        id: tx.id,
        amount,
        description: description.trim() || undefined,
        notes: notes.trim() || null,
        categoryId,
        receiptUrl,
      });
    }
  }

  return (
    <Dialog open={!!tx} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar movimiento</DialogTitle>
          <DialogDescription>
            {formatDate(tx.occurredAt, 'D [de] MMMM YYYY')} ·{' '}
            {tx.isRecurring ? 'Pago recurrente' : 'Movimiento puntual'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="edit-amount">Monto</Label>
            <MoneyInput
              id="edit-amount"
              className="mt-1.5 font-mono tabular-nums text-lg"
              value={amount}
              onChange={(v) => setAmount(typeof v === 'number' ? v : 0)}
            />
          </div>

          <div>
            <Label htmlFor="edit-desc">Descripción</Label>
            <Input
              id="edit-desc"
              className="mt-1.5"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Salario, Spotify, mercado…"
            />
          </div>

          {showCategory ? (
            <div>
              <Label htmlFor="edit-category">
                Categoría {categoryRequired ? '' : '(opcional)'}
              </Label>
              <Select
                value={categoryId ?? '__none__'}
                onValueChange={(v) => setCategoryId(v === '__none__' ? null : v)}
              >
                <SelectTrigger id="edit-category" className="mt-1.5">
                  <SelectValue placeholder="Selecciona categoría" />
                </SelectTrigger>
                <SelectContent>
                  {!categoryRequired ? (
                    <SelectItem value="__none__">Sin categoría</SelectItem>
                  ) : null}
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div>
            <Label htmlFor="edit-notes">Notas (opcional)</Label>
            <Textarea
              id="edit-notes"
              className="mt-1.5"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {showReceipt ? (
            <div>
              <Label>Comprobante (opcional)</Label>
              <div className="mt-1.5">
                <FileUpload
                  value={receiptUrl ?? undefined}
                  onChange={(v) => setReceiptUrl(v ?? null)}
                />
              </div>
            </div>
          ) : null}

          {tx.isRecurring ? (
            <fieldset className="rounded-md border border-border/60 bg-muted/30 p-3">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Alcance del cambio
              </legend>
              <div className="flex flex-col gap-2">
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="edit-mode"
                    value="this_month"
                    checked={mode === 'this_month'}
                    onChange={() => setMode('this_month')}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium">Solo este mes</span>
                    <span className="block text-xs text-muted-foreground">
                      El cambio aplica solo a esta ocurrencia. La regla recurrente sigue igual para
                      los demás meses.
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
                    <span className="font-medium">Desde este mes en adelante</span>
                    <span className="block text-xs text-muted-foreground">
                      Los meses pasados se conservan con su valor original. Desde este mes en
                      adelante se usa el nuevo valor.
                    </span>
                  </span>
                </label>
              </div>
            </fieldset>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={isPending || !canSubmit}>
            {isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
