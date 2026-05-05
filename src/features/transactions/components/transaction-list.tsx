'use client';

import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CreditCard,
  PiggyBank,
  Trash2,
  Wallet,
} from 'lucide-react';
import { useAction } from 'next-safe-action/hooks';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { isExpenseOfMonth, isIncomeOfMonth, type TransactionKind } from '@/lib/accounting/shared';
import { dayjs, formatAmount, formatDate } from '@/lib/format';
import type { CurrencyCode } from '@/lib/money';
import { cn } from '@/lib/utils';
import { deleteRecurringAction, deleteTransactionAction, togglePaidAction } from '../actions';

export interface TxListItem {
  id: string;
  kind: TransactionKind;
  amountMinor: bigint;
  currency: string;
  transactionDate: string;
  description: string | null;
  notes: string | null;
  accountId: string;
  counterAccountId: string | null;
  categoryId: string | null;
  debtId: string | null;
  savingsGoalId: string | null;
  receiptUrl: string | null;
  isPaid: boolean;
  recurringRuleId: string | null;
  account: { name: string; type: string } | null;
  counterAccount: { name: string } | null;
  category: { name: string; color: string; icon: string } | null;
  debt?: { name: string } | null;
  savingsGoal?: { name: string } | null;
}

function groupByDay(items: TxListItem[]): Record<string, TxListItem[]> {
  const out: Record<string, TxListItem[]> = {};
  for (const it of items) {
    if (!out[it.transactionDate]) out[it.transactionDate] = [];
    out[it.transactionDate]!.push(it);
  }
  return out;
}

function iconForKind(kind: TransactionKind) {
  if (kind === 'transfer') return ArrowLeftRight;
  if (kind === 'cc_charge') return CreditCard;
  if (kind === 'cc_payment') return ArrowLeftRight;
  if (kind === 'loan_payment') return ArrowLeftRight;
  if (kind === 'savings_contribution') return PiggyBank;
  if (kind === 'refund') return ArrowUpRight;
  if (isIncomeOfMonth(kind)) return ArrowUpRight;
  if (isExpenseOfMonth(kind)) return ArrowDownLeft;
  return Wallet;
}

interface Props {
  items: TxListItem[];
}

export function TransactionList({ items }: Props) {
  const [pendingDelete, setPendingDelete] = useState<TxListItem | null>(null);
  const [deleteScope, setDeleteScope] = useState<'this_one' | 'forward'>('this_one');

  const deleteOnce = useAction(deleteTransactionAction, {
    onSuccess: () => {
      toast.success('Movimiento eliminado');
      setPendingDelete(null);
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'No se pudo eliminar'),
  });

  const deleteRec = useAction(deleteRecurringAction, {
    onSuccess: () => {
      toast.success(
        deleteScope === 'forward'
          ? 'Eliminado de este movimiento en adelante'
          : 'Movimiento eliminado',
      );
      setPendingDelete(null);
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'No se pudo eliminar'),
  });
  const isDeleting = deleteOnce.isPending || deleteRec.isPending;

  const { grouped, days } = useMemo(() => {
    const g = groupByDay(items);
    return { grouped: g, days: Object.keys(g).sort((a, b) => (a < b ? 1 : -1)) };
  }, [items]);

  function executeDelete() {
    if (!pendingDelete) return;
    if (pendingDelete.recurringRuleId) {
      deleteRec.execute({ transactionId: pendingDelete.id, mode: deleteScope });
    } else {
      deleteOnce.execute({ id: pendingDelete.id });
    }
  }

  return (
    <>
      <div className="space-y-6">
        {days.map((day) => {
          const dayItems = grouped[day] ?? [];
          const dayNet = dayItems.reduce((acc, t) => {
            const value = Number(t.amountMinor);
            if (isIncomeOfMonth(t.kind)) return acc + value;
            if (isExpenseOfMonth(t.kind)) return acc - value;
            return acc;
          }, 0);

          return (
            <section key={day}>
              <div className="mb-2 flex items-center justify-between px-1 text-xs">
                <span className="font-semibold uppercase tracking-wide text-muted-foreground">
                  {dayjs(day).isSame(dayjs(), 'day')
                    ? 'Hoy'
                    : dayjs(day).isSame(dayjs().subtract(1, 'day'), 'day')
                      ? 'Ayer'
                      : formatDate(day, 'dddd D [de] MMMM')}
                </span>
                <span
                  className={`font-mono tabular-nums ${
                    dayNet >= 0 ? 'text-amount-positive' : 'text-amount-negative'
                  }`}
                >
                  {formatAmount(dayNet / 100, (dayItems[0]?.currency ?? 'COP') as CurrencyCode, {
                    signDisplay: 'always',
                  })}
                </span>
              </div>
              <Card>
                <ul className="divide-y divide-border">
                  {dayItems.map((tx) => (
                    <TxRow
                      key={tx.id}
                      tx={tx}
                      onDelete={() => {
                        setDeleteScope('this_one');
                        setPendingDelete(tx);
                      }}
                    />
                  ))}
                </ul>
              </Card>
            </section>
          );
        })}
      </div>

      <Dialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar este movimiento?</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. Los saldos se recalculan al instante.
            </DialogDescription>
          </DialogHeader>
          {pendingDelete?.recurringRuleId ? (
            <fieldset className="rounded-md border border-border/60 bg-muted/30 p-3">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Alcance
              </legend>
              <div className="flex flex-col gap-2">
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="del-scope"
                    value="this_one"
                    checked={deleteScope === 'this_one'}
                    onChange={() => setDeleteScope('this_one')}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium">Solo esta ocurrencia</span>
                    <span className="block text-xs text-muted-foreground">
                      Borra solo este movimiento. La regla recurrente sigue activa.
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="del-scope"
                    value="forward"
                    checked={deleteScope === 'forward'}
                    onChange={() => setDeleteScope('forward')}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium">De aquí en adelante</span>
                    <span className="block text-xs text-muted-foreground">
                      Borra esta + futuras ocurrencias y desactiva la regla. El pasado se conserva.
                    </span>
                  </span>
                </label>
              </div>
            </fieldset>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={isDeleting} onClick={executeDelete}>
              {isDeleting ? 'Eliminando…' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface RowProps {
  tx: TxListItem;
  onDelete: () => void;
}

function TxRow({ tx, onDelete }: RowProps) {
  const expense = isExpenseOfMonth(tx.kind);
  const income = isIncomeOfMonth(tx.kind);
  const internal =
    tx.kind === 'transfer' || tx.kind === 'cc_charge' || tx.kind === 'savings_contribution';
  const amountMajor = Number(tx.amountMinor) / 100;
  const Icon = iconForKind(tx.kind);

  const togglePaid = useAction(togglePaidAction, {
    onError: ({ error }) => toast.error(error.serverError ?? 'No se pudo actualizar'),
  });

  const sublabel: string[] = [];
  if (tx.account?.name) sublabel.push(tx.account.name);
  if (tx.counterAccount?.name) sublabel.push(`→ ${tx.counterAccount.name}`);
  if (tx.category?.name) sublabel.push(tx.category.name);
  if (tx.debt?.name) sublabel.push(tx.debt.name);
  if (tx.savingsGoal?.name) sublabel.push(tx.savingsGoal.name);

  return (
    <li
      className={cn(
        'group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30',
        !tx.isPaid && 'opacity-60',
      )}
    >
      <Checkbox
        checked={tx.isPaid}
        aria-label={tx.isPaid ? 'Marcar como pendiente' : 'Marcar como confirmado'}
        disabled={togglePaid.isPending}
        onCheckedChange={(checked) => togglePaid.execute({ id: tx.id, isPaid: checked === true })}
        className="shrink-0"
      />
      <div
        className="grid size-10 shrink-0 place-items-center rounded-full"
        style={{
          backgroundColor: tx.category
            ? `color-mix(in oklch, ${tx.category.color} 20%, transparent)`
            : 'var(--muted)',
          color: tx.category?.color ?? 'var(--muted-foreground)',
        }}
        aria-hidden
      >
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate text-sm font-medium">
          <span className="truncate">
            {tx.description ||
              tx.category?.name ||
              tx.debt?.name ||
              tx.savingsGoal?.name ||
              'Movimiento'}
          </span>
          {tx.recurringRuleId ? (
            <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              Recurrente
            </span>
          ) : null}
          {tx.kind === 'cc_charge' ? (
            <span
              className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
              title="Compra con tarjeta de crédito — no cuenta como gasto del mes"
            >
              CC
            </span>
          ) : null}
        </p>
        {sublabel.length > 0 ? (
          <p className="truncate text-xs text-muted-foreground">{sublabel.join(' · ')}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-1">
        <span
          className={`font-mono tabular-nums text-sm font-semibold ${
            internal
              ? 'text-muted-foreground'
              : income
                ? 'text-amount-positive'
                : expense
                  ? 'text-amount-negative'
                  : 'text-foreground'
          }`}
        >
          {formatAmount(income ? amountMajor : -amountMajor, tx.currency as CurrencyCode, {
            signDisplay: income || expense ? 'always' : 'auto',
          })}
        </span>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Eliminar movimiento"
          className="size-9 transition-opacity md:size-8 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
          onClick={onDelete}
        >
          <Trash2 className="size-4 text-muted-foreground" />
        </Button>
      </div>
    </li>
  );
}
