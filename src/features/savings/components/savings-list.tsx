'use client';

import { Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useAction } from 'next-safe-action/hooks';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
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
import { deleteSavingsGoalAction } from '../actions';

export interface SavingsGoalItem {
  id: string;
  name: string;
  targetAmountMinor: bigint;
  currentAmountMinor: bigint;
  projectedAmountMinor: bigint;
  monthlyContributionMinor: bigint;
  currency: string;
  color: string;
  targetDate: string | null;
}

interface Props {
  items: SavingsGoalItem[];
}

export function SavingsList({ items }: Props) {
  const [deleting, setDeleting] = useState<SavingsGoalItem | null>(null);

  const remove = useAction(deleteSavingsGoalAction, {
    onSuccess: () => {
      toast.success('Meta eliminada');
      setDeleting(null);
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Error'),
  });

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((g) => {
          const target = Number(g.targetAmountMinor) / 100;
          const current = Number(g.currentAmountMinor) / 100;
          const projected = Number(g.projectedAmountMinor) / 100;
          const monthly = Number(g.monthlyContributionMinor) / 100;
          const pct = target > 0 ? Math.round((current / target) * 100) : 0;
          const reached = pct >= 100;

          return (
            <Card key={g.id} className="transition-colors hover:border-primary/40">
              <CardContent className="space-y-3 p-0">
                <div className="flex items-start justify-between gap-2 p-5 pb-0">
                  <Link
                    href={`/ahorros/${g.id}`}
                    className="min-w-0 flex-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Ver detalle de ${g.name}`}
                  >
                    <h3 className="truncate text-sm font-semibold">{g.name}</h3>
                    {reached ? (
                      <Badge variant="success" className="mt-1">
                        Cumplida
                      </Badge>
                    ) : g.targetDate ? (
                      <Badge variant="outline" className="mt-1 font-normal">
                        Meta {g.targetDate}
                      </Badge>
                    ) : null}
                  </Link>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Eliminar meta"
                    onClick={() => setDeleting(g)}
                  >
                    <Trash2 className="size-4 text-muted-foreground" />
                  </Button>
                </div>
                <Link
                  href={`/ahorros/${g.id}`}
                  className="block px-5 pb-5 focus-visible:outline-none"
                  aria-label={`Ver detalle de ${g.name}`}
                >
                  <p className="font-mono tabular-nums text-lg font-semibold">
                    {formatAmount(current, g.currency as CurrencyCode)}
                    <span className="text-sm font-normal text-muted-foreground">
                      {' / '}
                      {formatAmount(target, g.currency as CurrencyCode)}
                    </span>
                  </p>
                  <Progress className="mt-2" value={Math.min(100, pct)} />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {pct}% — aporte sugerido {formatAmount(monthly, g.currency as CurrencyCode)}/mes
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Estimado fin de mes:{' '}
                    <span className="font-mono tabular-nums">
                      {formatAmount(projected, g.currency as CurrencyCode)}
                    </span>
                  </p>
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <ResponsiveDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>¿Eliminar esta meta?</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>{deleting?.name}</ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogBody>
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleting(null)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={remove.isPending}
                onClick={() => deleting && remove.execute({ id: deleting.id })}
              >
                {remove.isPending ? 'Eliminando…' : 'Eliminar'}
              </Button>
            </div>
          </ResponsiveDialogBody>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}
