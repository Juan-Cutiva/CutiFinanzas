'use client';

import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Eye, Pencil, Trash2 } from 'lucide-react';
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
import { dayjs, formatAmount, formatDate } from '@/lib/format';
import type { CurrencyCode } from '@/lib/money';
import { cn } from '@/lib/utils';
import { deleteTransactionAction, togglePaidAction } from '../actions';
import { isExpenseKind, isIncomeKind } from '../domain';
import {
  type CategoryOption,
  type EditableTx,
  EditTransactionDialog,
} from './edit-transaction-dialog';
import { type ViewableTx, ViewTransactionDialog } from './view-transaction-dialog';

export interface TxListItem {
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
  isPaid: boolean;
  recurringRuleId: string | null;
  account: { name: string; type: string } | null;
  transferAccount: { name: string } | null;
  category: { name: string; color: string; icon: string } | null;
}

const PURCHASE_KINDS_LIST = new Set(['expense_fixed', 'expense_variable']);

function isCreditPurchase(tx: TxListItem): boolean {
  return (
    PURCHASE_KINDS_LIST.has(tx.kind) &&
    (tx.account?.type === 'credit_card' || tx.account?.type === 'loan')
  );
}

const NON_EDITABLE_KINDS = new Set(['transfer', 'savings_contribution']);

function groupByDay(items: TxListItem[]): Record<string, TxListItem[]> {
  const groups: Record<string, TxListItem[]> = {};
  for (const it of items) {
    const day = it.occurredAt;
    if (!groups[day]) groups[day] = [];
    groups[day].push(it);
  }
  return groups;
}

interface Props {
  items: TxListItem[];
  categories?: CategoryOption[];
}

export function TransactionList({ items, categories = [] }: Props) {
  const [pendingDelete, setPendingDelete] = useState<TxListItem | null>(null);
  const [editing, setEditing] = useState<EditableTx | null>(null);
  const [viewing, setViewing] = useState<ViewableTx | null>(null);

  const { execute, isPending } = useAction(deleteTransactionAction, {
    onSuccess: () => {
      toast.success('Movimiento eliminado');
      setPendingDelete(null);
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? 'No se pudo eliminar');
    },
  });

  const { grouped, days } = useMemo(() => {
    const g = groupByDay(items);
    return { grouped: g, days: Object.keys(g).sort((a, b) => (a < b ? 1 : -1)) };
  }, [items]);

  function handleEdit(tx: TxListItem) {
    setEditing({
      id: tx.id,
      kind: tx.kind,
      amountMinor: tx.amountMinor,
      currency: tx.currency,
      occurredAt: tx.occurredAt,
      description: tx.description,
      notes: tx.notes,
      categoryId: tx.categoryId,
      receiptUrl: tx.receiptUrl,
      isRecurring: tx.isRecurring || tx.id.startsWith('virtual:'),
    });
  }

  function handleView(tx: TxListItem) {
    setViewing({
      id: tx.id,
      kind: tx.kind,
      amountMinor: tx.amountMinor,
      currency: tx.currency,
      occurredAt: tx.occurredAt,
      description: tx.description,
      notes: tx.notes,
      receiptUrl: tx.receiptUrl,
      isRecurring: tx.isRecurring,
      account: tx.account,
      transferAccount: tx.transferAccount,
      category: tx.category,
    });
  }

  return (
    <>
      <div className="space-y-6">
        {days.map((day) => {
          const dayItems = grouped[day] ?? [];
          const dayNet = dayItems.reduce((acc, t) => {
            if (isCreditPurchase(t)) return acc;
            const value = Number(t.amountMinor);
            return acc + (isIncomeKind(t.kind) ? value : -value);
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
                      onView={() => handleView(tx)}
                      onEdit={() => handleEdit(tx)}
                      onDelete={() => setPendingDelete(tx)}
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
              Esta acción no se puede deshacer. Los saldos de tus cuentas se ajustarán.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() => pendingDelete && execute({ id: pendingDelete.id })}
            >
              {isPending ? 'Eliminando…' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditTransactionDialog
        tx={editing}
        categories={categories}
        onClose={() => setEditing(null)}
      />

      <ViewTransactionDialog tx={viewing} onClose={() => setViewing(null)} />
    </>
  );
}

interface RowProps {
  tx: TxListItem;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function TxRow({ tx, onView, onEdit, onDelete }: RowProps) {
  const expense = isExpenseKind(tx.kind);
  const income = isIncomeKind(tx.kind);
  const transfer = tx.kind === 'transfer' || tx.kind === 'credit_card_payment';
  const isVirtual = tx.id.startsWith('virtual:');
  const creditPurchase = isCreditPurchase(tx);
  const amountMajor = Number(tx.amountMinor) / 100;
  const displayAmount = expense ? -amountMajor : amountMajor;
  const Icon = transfer ? ArrowLeftRight : income ? ArrowUpRight : ArrowDownLeft;
  const editable = !NON_EDITABLE_KINDS.has(tx.kind);

  const togglePaid = useAction(togglePaidAction, {
    onError: ({ error }) => {
      toast.error(error.serverError ?? 'No se pudo actualizar');
    },
  });

  return (
    <li
      className={cn(
        'group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30',
        isVirtual && 'opacity-80',
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
            {tx.description || tx.category?.name || (transfer ? 'Transferencia' : '—')}
          </span>
          {isVirtual ? (
            <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              Programado
            </span>
          ) : null}
          {creditPurchase ? (
            <span
              className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
              title="Compra con tarjeta de crédito — no cuenta en balance ni totales"
            >
              No cuenta
            </span>
          ) : null}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {tx.account?.name ?? '—'}
          {transfer && tx.transferAccount ? ` → ${tx.transferAccount.name}` : ''}
          {tx.category && !transfer ? ` · ${tx.category.name}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <span
          className={`font-mono tabular-nums text-sm font-semibold ${
            creditPurchase
              ? 'text-muted-foreground line-through decoration-muted-foreground/40'
              : income
                ? 'text-amount-positive'
                : expense
                  ? 'text-amount-negative'
                  : 'text-foreground'
          }`}
        >
          {formatAmount(displayAmount, tx.currency as CurrencyCode, {
            signDisplay: income || expense ? 'always' : 'auto',
          })}
        </span>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Ver detalles"
          className="size-9 transition-opacity md:size-8 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
          onClick={onView}
        >
          <Eye className="size-4 text-muted-foreground" />
        </Button>
        {editable ? (
          <Button
            size="icon"
            variant="ghost"
            aria-label="Editar movimiento"
            className="size-9 transition-opacity md:size-8 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
            onClick={onEdit}
          >
            <Pencil className="size-4 text-muted-foreground" />
          </Button>
        ) : null}
        {isVirtual ? null : (
          <Button
            size="icon"
            variant="ghost"
            aria-label="Eliminar movimiento"
            className="size-9 transition-opacity md:size-8 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
            onClick={onDelete}
          >
            <Trash2 className="size-4 text-muted-foreground" />
          </Button>
        )}
      </div>
    </li>
  );
}
