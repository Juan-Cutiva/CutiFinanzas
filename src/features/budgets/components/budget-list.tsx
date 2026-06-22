'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { useAction } from 'next-safe-action/hooks';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
import { formatAmount } from '@/lib/format';
import type { CurrencyCode } from '@/lib/money';
import { deleteBudgetAction } from '../actions';
import { type EditableBudget, EditBudgetDialog } from './edit-budget-dialog';

export interface BudgetWithSpent {
  id: string;
  amountMinor: bigint;
  currency: string;
  spentMinor: number;
  year: number;
  month: number;
  notes: string | null;
  isVirtual: boolean;
  category: { name: string; color: string };
}

export function BudgetList({ items }: { items: BudgetWithSpent[] }) {
  const [editing, setEditing] = useState<EditableBudget | null>(null);
  const [pendingDelete, setPendingDelete] = useState<BudgetWithSpent | null>(null);

  const { execute, isPending } = useAction(deleteBudgetAction, {
    onSuccess: () => {
      toast.success('Presupuesto eliminado');
      setPendingDelete(null);
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'No se pudo eliminar'),
  });

  function handleEdit(b: BudgetWithSpent) {
    setEditing({
      id: b.id,
      categoryName: b.category.name,
      amountMinor: b.amountMinor,
      currency: b.currency,
      year: b.year,
      month: b.month,
      notes: b.notes,
    });
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((b) => {
          const planned = Number(b.amountMinor) / 100;
          const spent = b.spentMinor / 100;
          const pct = planned > 0 ? Math.min(150, Math.round((spent / planned) * 100)) : 0;
          const tone = pct > 100 ? 'destructive' : pct >= 80 ? 'warning' : 'ok';

          return (
            <Card key={b.id} className="group">
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: b.category.color }}
                      aria-hidden
                    />
                    <span className="truncate text-sm font-medium">{b.category.name}</span>
                    {b.isVirtual ? (
                      <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        Recurrente
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-mono tabular-nums text-sm">
                      {formatAmount(spent, b.currency as CurrencyCode)}
                      <span className="text-muted-foreground">
                        {' / '}
                        {formatAmount(planned, b.currency as CurrencyCode)}
                      </span>
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Editar presupuesto"
                      className="size-9 transition-opacity md:size-8 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                      onClick={() => handleEdit(b)}
                    >
                      <Pencil className="size-4 text-muted-foreground" />
                    </Button>
                    {!b.isVirtual ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Eliminar presupuesto"
                        className="size-9 transition-opacity md:size-8 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                        onClick={() => setPendingDelete(b)}
                      >
                        <Trash2 className="size-4 text-muted-foreground" />
                      </Button>
                    ) : null}
                  </div>
                </div>
                <Progress
                  value={Math.min(100, pct)}
                  indicatorClassName={
                    tone === 'destructive'
                      ? 'bg-destructive'
                      : tone === 'warning'
                        ? 'bg-[color:var(--warning)]'
                        : 'bg-[color:var(--success)]'
                  }
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{pct}% usado</span>
                  {pct > 100 ? (
                    <span className="text-destructive">
                      Excedido {formatAmount(spent - planned, b.currency as CurrencyCode)}
                    </span>
                  ) : (
                    <span>
                      Disponible{' '}
                      {formatAmount(Math.max(0, planned - spent), b.currency as CurrencyCode)}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <EditBudgetDialog budget={editing} onClose={() => setEditing(null)} />

      <ResponsiveDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>¿Eliminar este presupuesto?</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Borra el presupuesto de {pendingDelete?.category.name}. Si era una regla recurrente,
              los meses futuros volverán al monto anterior (o quedarán sin presupuesto).
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogBody>
            <div className="mt-2 flex justify-end gap-2">
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
            </div>
          </ResponsiveDialogBody>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}
