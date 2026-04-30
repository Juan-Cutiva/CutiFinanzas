'use client';

import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Trash2 } from 'lucide-react';
import { useAction } from 'next-safe-action/hooks';
import { useState } from 'react';
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
import { dayjs, formatAmount, formatDate } from '@/lib/format';
import type { CurrencyCode } from '@/lib/money';
import { deleteTransactionAction } from '../actions';
import { isExpenseKind, isIncomeKind } from '../domain';

export interface TxListItem {
  id: string;
  kind: string;
  amountMinor: bigint;
  currency: string;
  occurredAt: string;
  description: string | null;
  account: { name: string } | null;
  transferAccount: { name: string } | null;
  category: { name: string; color: string; icon: string } | null;
}

function groupByDay(items: TxListItem[]): Record<string, TxListItem[]> {
  const groups: Record<string, TxListItem[]> = {};
  for (const it of items) {
    const day = it.occurredAt;
    if (!groups[day]) groups[day] = [];
    groups[day].push(it);
  }
  return groups;
}

export function TransactionList({ items }: { items: TxListItem[] }) {
  const [pendingDelete, setPendingDelete] = useState<TxListItem | null>(null);
  const { execute, isPending } = useAction(deleteTransactionAction, {
    onSuccess: () => {
      toast.success('Movimiento eliminado');
      setPendingDelete(null);
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? 'No se pudo eliminar');
    },
  });

  const grouped = groupByDay(items);
  const days = Object.keys(grouped).sort((a, b) => (a < b ? 1 : -1));

  return (
    <>
      <div className="space-y-6">
        {days.map((day) => {
          const dayItems = grouped[day] ?? [];
          const dayNet = dayItems.reduce((acc, t) => {
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
                    <TxRow key={tx.id} tx={tx} onDelete={() => setPendingDelete(tx)} />
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
    </>
  );
}

function TxRow({ tx, onDelete }: { tx: TxListItem; onDelete: () => void }) {
  const expense = isExpenseKind(tx.kind);
  const income = isIncomeKind(tx.kind);
  const transfer = tx.kind === 'transfer';
  const amountMajor = Number(tx.amountMinor) / 100;
  const Icon = transfer ? ArrowLeftRight : income ? ArrowUpRight : ArrowDownLeft;

  return (
    <li className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30">
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
        <p className="truncate text-sm font-medium">
          {tx.description || tx.category?.name || (transfer ? 'Transferencia' : '—')}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {tx.account?.name ?? '—'}
          {transfer && tx.transferAccount ? ` → ${tx.transferAccount.name}` : ''}
          {tx.category && !transfer ? ` · ${tx.category.name}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`font-mono tabular-nums text-sm font-semibold ${
            income ? 'text-amount-positive' : expense ? 'text-amount-negative' : 'text-foreground'
          }`}
        >
          {formatAmount(amountMajor, tx.currency as CurrencyCode, {
            signDisplay: income ? 'always' : 'auto',
          })}
        </span>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Eliminar movimiento"
          className="size-8 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          onClick={onDelete}
        >
          <Trash2 className="size-4 text-muted-foreground" />
        </Button>
      </div>
    </li>
  );
}
