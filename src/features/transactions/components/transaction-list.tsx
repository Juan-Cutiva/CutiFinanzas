'use client';

import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CreditCard,
  Eye,
  MoreVertical,
  Pencil,
  PiggyBank,
  Receipt,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
import {
  deltaFor,
  isExpenseOfMonth,
  isIncomeOfMonth,
  isInternal,
  type TransactionKind,
} from '@/lib/accounting/shared';
import { dayjs, formatAmount, formatDate } from '@/lib/format';
import type { CurrencyCode } from '@/lib/money';
import { cn } from '@/lib/utils';
import {
  deleteRecurringAction,
  deleteTransactionAction,
  deleteVirtualAction,
  togglePaidAction,
} from '../actions';
import {
  type CategoryOption,
  type EditableTx,
  EditTransactionDialog,
} from './edit-transaction-dialog';
import { type ViewableTx, ViewTransactionDialog } from './view-transaction-dialog';

export interface TxListItem {
  id: string;
  kind: TransactionKind;
  amountMinor: bigint;
  currency: string;
  transactionDate: string;
  description: string | null;
  notes: string | null;
  /** Nullable: `loan_charge` puede no involucrar ninguna cuenta asset. */
  accountId: string | null;
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
  /** True para ocurrencias proyectadas (cron aún no las materializa). */
  isVirtual?: boolean;
}

function groupByDay(items: TxListItem[]): Record<string, TxListItem[]> {
  const out: Record<string, TxListItem[]> = {};
  for (const it of items) {
    const day = it.transactionDate;
    let dayItems = out[day];
    if (!dayItems) {
      dayItems = [];
      out[day] = dayItems;
    }
    dayItems.push(it);
  }
  return out;
}

function iconForKind(kind: TransactionKind) {
  if (kind === 'transfer') return ArrowLeftRight;
  if (kind === 'cc_charge') return CreditCard;
  if (kind === 'cc_payment') return ArrowLeftRight;
  if (kind === 'loan_payment') return ArrowLeftRight;
  if (kind === 'loan_charge') return Receipt;
  if (kind === 'savings_contribution') return PiggyBank;
  if (kind === 'refund') return ArrowUpRight;
  if (isIncomeOfMonth(kind)) return ArrowUpRight;
  if (isExpenseOfMonth(kind)) return ArrowDownLeft;
  return Wallet;
}

interface Props {
  items: TxListItem[];
  categories?: CategoryOption[];
  /**
   * Si se define, el "neto del día" se calcula como el delta de ESA cuenta
   * (incluyendo transferencias en/out, cc_payment como destino, etc).
   * Sin viewAccountId: usa la lógica global (income − expense del mes).
   */
  viewAccountId?: string;
}

export function TransactionList({ items, categories = [], viewAccountId }: Props) {
  const [pendingDelete, setPendingDelete] = useState<TxListItem | null>(null);
  const [deleteScope, setDeleteScope] = useState<'this_one' | 'forward'>('this_one');
  const [viewing, setViewing] = useState<ViewableTx | null>(null);
  const [editing, setEditing] = useState<EditableTx | null>(null);

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

  const deleteVirt = useAction(deleteVirtualAction, {
    onSuccess: () => {
      toast.success(
        deleteScope === 'forward'
          ? 'Recurrente cancelada de este mes en adelante'
          : 'Ocurrencia omitida',
      );
      setPendingDelete(null);
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'No se pudo eliminar'),
  });
  const isDeleting = deleteOnce.isPending || deleteRec.isPending || deleteVirt.isPending;

  const { grouped, days } = useMemo(() => {
    const g = groupByDay(items);
    return {
      grouped: g,
      days: Object.keys(g).sort((a, b) => (a < b ? 1 : -1)),
    };
  }, [items]);

  function executeDelete() {
    if (!pendingDelete) return;
    if (pendingDelete.isVirtual) {
      // Virtual: parsear `virtual:<ruleId>:<YYYY-MM-DD>` y llamar action específica.
      const parts = pendingDelete.id.split(':');
      const ruleId = parts[1];
      const occurrenceDate = parts[2];
      if (!ruleId || !occurrenceDate) return;
      deleteVirt.execute({ ruleId, occurrenceDate, mode: deleteScope });
    } else if (pendingDelete.recurringRuleId) {
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
          // Si la lista se está mostrando en una cuenta específica, el "neto del día"
          // refleja el delta REAL de esa cuenta (incluye transferencias, cc_payments,
          // etc). Si no, usa la lógica global (income − expense, transferencias neutras).
          const dayNet = viewAccountId
            ? dayItems.reduce((acc, t) => {
                const delta = deltaFor(
                  {
                    kind: t.kind,
                    amountMinor: t.amountMinor,
                    accountId: t.accountId,
                    counterAccountId: t.counterAccountId,
                  },
                  viewAccountId,
                );
                return acc + Number(delta);
              }, 0)
            : dayItems.reduce((acc, t) => {
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
                      onView={() =>
                        setViewing({
                          id: tx.id,
                          kind: tx.kind,
                          amountMinor: tx.amountMinor,
                          currency: tx.currency,
                          transactionDate: tx.transactionDate,
                          description: tx.description,
                          notes: tx.notes,
                          receiptUrl: tx.receiptUrl,
                          recurringRuleId: tx.recurringRuleId,
                          account: tx.account ? { name: tx.account.name } : null,
                          counterAccount: tx.counterAccount,
                          category: tx.category,
                          debt: tx.debt,
                          savingsGoal: tx.savingsGoal,
                        })
                      }
                      onEdit={() =>
                        setEditing({
                          id: tx.id,
                          kind: tx.kind,
                          amountMinor: tx.amountMinor,
                          currency: tx.currency,
                          transactionDate: tx.transactionDate,
                          description: tx.description,
                          notes: tx.notes,
                          categoryId: tx.categoryId,
                          recurringRuleId: tx.recurringRuleId,
                          isVirtual: tx.isVirtual === true,
                        })
                      }
                      onDelete={() => {
                        setDeleteScope(tx.isVirtual ? 'forward' : 'this_one');
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

      <ResponsiveDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>¿Eliminar este movimiento?</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Esta acción no se puede deshacer. Los saldos se recalculan al instante.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogBody>
            {pendingDelete?.recurringRuleId || pendingDelete?.isVirtual ? (
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
                        {pendingDelete?.isVirtual
                          ? 'Omite esta fecha (queda como "Omitido"). La regla sigue activa para los demás meses.'
                          : 'Borra solo este movimiento. La regla recurrente sigue activa.'}
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
                        Borra esta + futuras ocurrencias y desactiva la regla. El pasado se
                        conserva.
                      </span>
                    </span>
                  </label>
                </div>
              </fieldset>
            ) : null}
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPendingDelete(null)}>
                Cancelar
              </Button>
              <Button variant="destructive" disabled={isDeleting} onClick={executeDelete}>
                {isDeleting ? 'Eliminando…' : 'Eliminar'}
              </Button>
            </div>
          </ResponsiveDialogBody>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ViewTransactionDialog tx={viewing} onClose={() => setViewing(null)} />
      <EditTransactionDialog
        tx={editing}
        categories={categories}
        onClose={() => setEditing(null)}
      />
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
  const expense = isExpenseOfMonth(tx.kind);
  const income = isIncomeOfMonth(tx.kind);
  const internal = isInternal(tx.kind);
  const amountMajor = Number(tx.amountMinor) / 100;
  const Icon = iconForKind(tx.kind);
  const isVirtual = tx.isVirtual === true;

  const togglePaid = useAction(togglePaidAction, {
    onError: ({ error }) => toast.error(error.serverError ?? 'No se pudo actualizar'),
  });

  const sublabel: string[] = [];
  if (tx.account?.name) sublabel.push(tx.account.name);
  if (tx.counterAccount?.name) sublabel.push(`→ ${tx.counterAccount.name}`);
  if (tx.category?.name) sublabel.push(tx.category.name);
  if (tx.debt?.name) sublabel.push(tx.debt.name);
  if (tx.savingsGoal?.name) sublabel.push(tx.savingsGoal.name);

  const title =
    tx.description || tx.category?.name || tx.debt?.name || tx.savingsGoal?.name || 'Movimiento';

  return (
    <li
      className={cn(
        'flex items-center gap-3 px-3 py-3.5 transition-colors hover:bg-muted/30 sm:px-4',
        isVirtual && 'opacity-70',
        !tx.isPaid && !isVirtual && 'opacity-60',
      )}
    >
      {isVirtual ? (
        <span
          role="img"
          className="grid size-5 shrink-0 place-items-center self-start rounded border border-dashed border-muted-foreground/40"
          aria-label="Programado, aún no aplicado"
          title="Aún no se aplica — se materializa en su fecha"
        />
      ) : (
        <Checkbox
          checked={tx.isPaid}
          aria-label={tx.isPaid ? 'Marcar como pendiente' : 'Marcar como confirmado'}
          disabled={togglePaid.isPending}
          onCheckedChange={(checked) => togglePaid.execute({ id: tx.id, isPaid: checked === true })}
          className="size-5 shrink-0 self-start"
        />
      )}
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
        <Icon className="size-[1.1rem]" />
      </div>

      {/* Contenido: descripción en línea 1 (todo el ancho), metadatos + badge en
          línea 2. Antes el badge competía con la descripción y la truncaba. */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-tight">{title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
          {isVirtual ? (
            <span className="rounded bg-[color:var(--info)]/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--info)]">
              Programado
            </span>
          ) : tx.recurringRuleId ? (
            <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              Recurrente
            </span>
          ) : null}
          {tx.kind === 'cc_charge' ? (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              CC
            </span>
          ) : null}
          {sublabel.length > 0 ? <span className="truncate">{sublabel.join(' · ')}</span> : null}
        </div>
      </div>

      {/* Monto + menú de acciones (⋮). El menú reemplaza los 3 botones que en
          mobile aplastaban la fila y truncaban el texto. */}
      <div className="flex shrink-0 items-center gap-1 self-start">
        <span
          className={cn(
            'font-mono tabular-nums text-sm font-semibold whitespace-nowrap',
            internal
              ? 'text-muted-foreground'
              : income
                ? 'text-amount-positive'
                : expense
                  ? 'text-amount-negative'
                  : 'text-foreground',
          )}
          title={internal ? 'Movimiento interno — no afecta tu patrimonio total' : undefined}
        >
          {internal
            ? `⇆ ${formatAmount(amountMajor, tx.currency as CurrencyCode, { signDisplay: 'auto' })}`
            : formatAmount(income ? amountMajor : -amountMajor, tx.currency as CurrencyCode, {
                signDisplay: income || expense ? 'always' : 'auto',
              })}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Acciones del movimiento"
              className="size-9 shrink-0 text-muted-foreground"
            >
              <MoreVertical className="size-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onView}>
              <Eye className="size-4" /> Ver detalles
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil className="size-4" /> Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={onDelete}>
              <Trash2 className="size-4" /> Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
