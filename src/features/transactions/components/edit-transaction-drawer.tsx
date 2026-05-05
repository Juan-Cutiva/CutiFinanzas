'use client';

import dynamic from 'next/dynamic';
import { useAction } from 'next-safe-action/hooks';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { DayOfMonthPicker, nextDateForDayOfMonth } from '@/components/ui/day-of-month-picker';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
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
import { updateRecurringTransactionAction, updateTransactionFullAction } from '../actions';
import {
  KINDS_WITH_FREQUENCY,
  PRIMARY_KIND_LABELS,
  type PrimaryKind,
  type TransactionInput,
} from '../schema';

const FileUpload = dynamic(() => import('@/components/ui/file-upload').then((m) => m.FileUpload), {
  ssr: false,
  loading: () => <div className="h-11 animate-pulse rounded-md border border-input bg-muted/30" />,
});

export interface AccountOption {
  id: string;
  name: string;
  currency: string;
  type: string;
}

export interface CategoryOption {
  id: string;
  name: string;
}

export interface DebtOption {
  id: string;
  name: string;
  currency: string;
}

export interface SavingsOption {
  id: string;
  name: string;
  currency: string;
}

export interface EditableTx {
  id: string;
  kind: TransactionInput['kind'];
  amountMinor: bigint;
  currency: string;
  occurredAt: string;
  description: string | null;
  notes: string | null;
  categoryId: string | null;
  debtId: string | null;
  savingsGoalId: string | null;
  accountId: string;
  transferAccountId: string | null;
  receiptUrl: string | null;
  isRecurring: boolean;
}

interface Props {
  tx: EditableTx | null;
  accounts: AccountOption[];
  categories: CategoryOption[];
  debts: DebtOption[];
  savingsGoals: SavingsOption[];
  onClose: () => void;
}

function primaryFromKind(kind: TransactionInput['kind']): PrimaryKind {
  if (kind === 'income_fixed' || kind === 'income_variable') return 'income';
  if (kind === 'expense_fixed' || kind === 'expense_variable') return 'expense';
  return kind as PrimaryKind;
}

function isFixed(kind: TransactionInput['kind']): boolean {
  return kind === 'income_fixed' || kind === 'expense_fixed';
}

function buildKind(primary: PrimaryKind, freq: 'fixed' | 'variable'): TransactionInput['kind'] {
  if (primary === 'income') return freq === 'fixed' ? 'income_fixed' : 'income_variable';
  if (primary === 'expense') return freq === 'fixed' ? 'expense_fixed' : 'expense_variable';
  return primary as TransactionInput['kind'];
}

const CATEGORY_REQUIRED = new Set(['expense_fixed', 'expense_variable']);

const RECEIPT_KINDS = new Set([
  'expense_fixed',
  'expense_variable',
  'credit_card_payment',
  'debt_payment',
  'income_fixed',
  'income_variable',
  'refund',
]);

export function EditTransactionDrawer({
  tx,
  accounts,
  categories,
  debts,
  savingsGoals,
  onClose,
}: Props) {
  const [amount, setAmount] = React.useState<number>(0);
  const [accountId, setAccountId] = React.useState<string>('');
  const [transferAccountId, setTransferAccountId] = React.useState<string | null>(null);
  const [categoryId, setCategoryId] = React.useState<string | null>(null);
  const [debtId, setDebtId] = React.useState<string | null>(null);
  const [savingsGoalId, setSavingsGoalId] = React.useState<string | null>(null);
  const [occurredAt, setOccurredAt] = React.useState<string>('');
  const [description, setDescription] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [receiptUrl, setReceiptUrl] = React.useState<string | null>(null);
  const [frequency, setFrequency] = React.useState<'fixed' | 'variable'>('variable');
  const [scope, setScope] = React.useState<'this_month' | 'forward'>('this_month');

  const primary = tx ? primaryFromKind(tx.kind) : ('expense' as PrimaryKind);

  React.useEffect(() => {
    if (!tx) return;
    setAmount(Number(tx.amountMinor) / 100);
    setAccountId(tx.accountId);
    setTransferAccountId(tx.transferAccountId);
    setCategoryId(tx.categoryId);
    setDebtId(tx.debtId);
    setSavingsGoalId(tx.savingsGoalId);
    setOccurredAt(tx.occurredAt);
    setDescription(tx.description ?? '');
    setNotes(tx.notes ?? '');
    setReceiptUrl(tx.receiptUrl);
    setFrequency(isFixed(tx.kind) || tx.isRecurring ? 'fixed' : 'variable');
    setScope('this_month');
  }, [tx]);

  const updateFull = useAction(updateTransactionFullAction, {
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
        scope === 'forward'
          ? 'Actualizado desde este mes en adelante'
          : 'Actualizado solo este mes',
      );
      onClose();
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? 'No se pudo actualizar');
    },
  });

  if (!tx) return null;

  const supportsFrequency = KINDS_WITH_FREQUENCY.has(primary);
  const newKind = supportsFrequency ? buildKind(primary, frequency) : tx.kind;
  const isTransferLike = newKind === 'transfer' || newKind === 'credit_card_payment';
  const isDebtPayment = newKind === 'debt_payment';
  const isSavingsContribution = newKind === 'savings_contribution';
  const showCategory =
    newKind === 'expense_fixed' ||
    newKind === 'expense_variable' ||
    newKind === 'credit_card_payment';
  const categoryRequired = CATEGORY_REQUIRED.has(newKind);
  const showReceipt = RECEIPT_KINDS.has(newKind);
  const willBeRecurring = isFixed(newKind);

  const isPending = updateFull.isPending || updateRecurring.isPending;

  const accountsForOrigin =
    newKind === 'credit_card_payment'
      ? accounts.filter((a) => a.type !== 'credit_card' && a.type !== 'loan')
      : accounts;
  const accountsForDestination =
    newKind === 'credit_card_payment'
      ? accounts.filter((a) => a.type === 'credit_card')
      : accounts.filter((a) => a.id !== accountId);

  const canSubmit =
    amount > 0 &&
    accountId !== '' &&
    (!categoryRequired || (categoryId !== null && categoryId !== '')) &&
    (!isTransferLike || transferAccountId !== null) &&
    (!isDebtPayment || debtId !== null) &&
    (!isSavingsContribution || savingsGoalId !== null);

  function submit() {
    if (!tx) return;

    // Las recurrentes con scope this_month/forward usan la mutation
    // específica que conserva el modelo de regla (no permite cambiar
    // todos los campos, solo monto / categoría / descripción / notas).
    if (tx.isRecurring) {
      updateRecurring.execute({
        id: tx.id,
        amount,
        description: description.trim() || undefined,
        notes: notes.trim() || null,
        categoryId,
        receiptUrl: scope === 'this_month' ? receiptUrl : undefined,
        mode: scope,
      });
      return;
    }

    updateFull.execute({
      id: tx.id,
      kind: newKind,
      accountId,
      transferAccountId: isTransferLike ? transferAccountId : null,
      categoryId: showCategory ? categoryId : null,
      debtId: isDebtPayment ? debtId : null,
      savingsGoalId: isSavingsContribution ? savingsGoalId : null,
      amount,
      occurredAt,
      description: description.trim() || undefined,
      notes: notes.trim() || null,
      receiptUrl: receiptUrl ?? null,
    });
  }

  return (
    <Drawer open={!!tx} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Editar movimiento</DrawerTitle>
          <DrawerDescription>
            {tx.isRecurring
              ? 'Pago recurrente — cambios afectan según el alcance que elijas.'
              : 'Movimiento puntual — puedes cambiar todos los campos.'}
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex flex-col gap-4 px-4 pb-6">
          <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Tipo: <strong>{PRIMARY_KIND_LABELS[primary]}</strong>. Para cambiarlo, borra y crea uno
            nuevo.
          </div>

          {supportsFrequency && !tx.isRecurring ? (
            <div>
              <Label htmlFor="edit-frequency">Frecuencia</Label>
              <Select
                value={frequency}
                onValueChange={(v) => setFrequency(v as 'fixed' | 'variable')}
              >
                <SelectTrigger id="edit-frequency" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="variable">Variable (puntual)</SelectItem>
                  <SelectItem value="fixed">Fijo (se repite cada mes)</SelectItem>
                </SelectContent>
              </Select>
              {willBeRecurring && !tx.isRecurring ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Al guardar, se creará una regla recurrente desde la fecha actual.
                </p>
              ) : null}
            </div>
          ) : null}

          <div>
            <Label htmlFor="edit-amount">Monto</Label>
            <MoneyInput
              id="edit-amount"
              className="mt-1.5 font-mono tabular-nums text-lg"
              value={amount}
              onChange={(v) => setAmount(typeof v === 'number' ? v : 0)}
            />
          </div>

          {!tx.isRecurring ? (
            <div>
              <Label htmlFor="edit-account">
                {newKind === 'credit_card_payment'
                  ? 'Pago desde la cuenta'
                  : isTransferLike
                    ? 'Desde la cuenta'
                    : 'Cuenta'}
              </Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger id="edit-account" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accountsForOrigin.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} · {a.currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {isTransferLike && !tx.isRecurring ? (
            <div>
              <Label htmlFor="edit-transfer">
                {newKind === 'credit_card_payment' ? 'Tarjeta a la que pagas' : 'A la cuenta'}
              </Label>
              <Select
                value={transferAccountId ?? ''}
                onValueChange={(v) => setTransferAccountId(v || null)}
              >
                <SelectTrigger id="edit-transfer" className="mt-1.5">
                  <SelectValue placeholder="Selecciona destino" />
                </SelectTrigger>
                <SelectContent>
                  {accountsForDestination.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} · {a.currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {isDebtPayment && !tx.isRecurring ? (
            <div>
              <Label htmlFor="edit-debt">Deuda</Label>
              <Select value={debtId ?? ''} onValueChange={(v) => setDebtId(v || null)}>
                <SelectTrigger id="edit-debt" className="mt-1.5">
                  <SelectValue placeholder="Selecciona la deuda" />
                </SelectTrigger>
                <SelectContent>
                  {debts.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} · {d.currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {isSavingsContribution && !tx.isRecurring ? (
            <div>
              <Label htmlFor="edit-goal">Meta de ahorro</Label>
              <Select
                value={savingsGoalId ?? ''}
                onValueChange={(v) => setSavingsGoalId(v || null)}
              >
                <SelectTrigger id="edit-goal" className="mt-1.5">
                  <SelectValue placeholder="Selecciona la meta" />
                </SelectTrigger>
                <SelectContent>
                  {savingsGoals.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name} · {g.currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

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

          {!tx.isRecurring ? (
            <div>
              <Label>{willBeRecurring ? 'Día del mes en que se repite' : 'Fecha'}</Label>
              <div className="mt-1.5">
                {willBeRecurring ? (
                  <DayOfMonthPicker
                    value={Number.parseInt(occurredAt.slice(8, 10), 10)}
                    onChange={(d) => setOccurredAt(nextDateForDayOfMonth(d))}
                  />
                ) : (
                  <DatePicker value={occurredAt} onChange={(v) => setOccurredAt(v ?? occurredAt)} />
                )}
              </div>
            </div>
          ) : null}

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

          {showReceipt && (!tx.isRecurring || scope === 'this_month') ? (
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
                    name="edit-scope"
                    value="this_month"
                    checked={scope === 'this_month'}
                    onChange={() => setScope('this_month')}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium">Solo este mes</span>
                    <span className="block text-xs text-muted-foreground">
                      El cambio aplica solo a esta ocurrencia.
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="edit-scope"
                    value="forward"
                    checked={scope === 'forward'}
                    onChange={() => setScope('forward')}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium">Desde este mes en adelante</span>
                    <span className="block text-xs text-muted-foreground">
                      Pasados se conservan; desde este mes se usa el nuevo valor.
                    </span>
                  </span>
                </label>
              </div>
            </fieldset>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={isPending || !canSubmit}>
              {isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
