'use client';

import { Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useAction } from 'next-safe-action/hooks';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { formatAmount } from '@/lib/format';
import type { CurrencyCode } from '@/lib/money';
import { deleteDebtAction } from '../actions';
import { annualToMonthlyRate, calculateRemainingMonths, debtProgress } from '../domain';

export interface DebtItem {
  id: string;
  name: string;
  principalMinor: bigint;
  realBalanceMinor: bigint;
  projectedBalanceMinor: bigint;
  currency: string;
  monthlyPaymentMinor: bigint;
  interestRateAnnual: number | null;
}

export function DebtList({ items }: { items: DebtItem[] }) {
  const [pending, setPending] = useState<DebtItem | null>(null);
  const { execute, isPending } = useAction(deleteDebtAction, {
    onSuccess: () => {
      toast.success('Deuda eliminada');
      setPending(null);
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Error'),
  });

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((d) => {
          const principal = Number(d.principalMinor) / 100;
          const realBalance = Number(d.realBalanceMinor) / 100;
          const projectedBalance = Number(d.projectedBalanceMinor) / 100;
          const monthly = Number(d.monthlyPaymentMinor) / 100;
          const monthlyRate = annualToMonthlyRate(d.interestRateAnnual);
          const monthsLeft = calculateRemainingMonths(realBalance, monthlyRate, monthly);
          const progress = debtProgress(principal, realBalance);
          const showProjection = realBalance !== projectedBalance;

          return (
            <Card key={d.id} className="transition-colors hover:border-primary/40">
              <CardContent className="space-y-3 p-0">
                <div className="flex items-start justify-between gap-3 p-5 pb-0">
                  <Link
                    href={`/deudas/${d.id}`}
                    className="min-w-0 flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
                    aria-label={`Ver detalle de ${d.name}`}
                  >
                    <h3 className="text-sm font-semibold">{d.name}</h3>
                    <p className="font-mono tabular-nums text-2xl font-semibold tracking-tight">
                      {formatAmount(realBalance, d.currency as CurrencyCode)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      de {formatAmount(principal, d.currency as CurrencyCode)} iniciales
                    </p>
                    {showProjection ? (
                      <p className="text-xs text-muted-foreground">
                        Estimado fin de mes:{' '}
                        <span className="font-mono tabular-nums">
                          {formatAmount(projectedBalance, d.currency as CurrencyCode)}
                        </span>
                      </p>
                    ) : null}
                  </Link>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    {monthsLeft !== null && monthsLeft > 0 ? (
                      <Badge variant="secondary">{monthsLeft} meses</Badge>
                    ) : monthsLeft === 0 ? (
                      <Badge variant="success">Pagada</Badge>
                    ) : (
                      <Badge variant="warning">Pago no cubre interés</Badge>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Eliminar"
                      onClick={() => setPending(d)}
                    >
                      <Trash2 className="size-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
                <div className="px-5 pb-5">
                  <Progress value={Math.round(progress * 100)} />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {Math.round(progress * 100)}% pagado · cuota{' '}
                    {formatAmount(monthly, d.currency as CurrencyCode)}/mes
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar esta deuda?</DialogTitle>
            <DialogDescription>{pending?.name}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() => pending && execute({ id: pending.id })}
            >
              {isPending ? 'Eliminando…' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
