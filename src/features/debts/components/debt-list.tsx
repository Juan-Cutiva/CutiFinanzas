'use client';

import { Trash2 } from 'lucide-react';
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
  initialAmountMinor: bigint;
  currentBalanceMinor: bigint;
  currency: string;
  monthlyPaymentMinor: bigint;
  interestRateAnnual: string | null;
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
      <div className="grid gap-3">
        {items.map((d) => {
          const initial = Number(d.initialAmountMinor) / 100;
          const balance = Number(d.currentBalanceMinor) / 100;
          const monthly = Number(d.monthlyPaymentMinor) / 100;
          const monthlyRate = annualToMonthlyRate(
            d.interestRateAnnual ? Number(d.interestRateAnnual) : null,
          );
          const monthsLeft = calculateRemainingMonths(balance, monthlyRate, monthly);
          const progress = debtProgress(initial, balance);

          return (
            <Card key={d.id}>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">{d.name}</h3>
                    <p className="font-mono tabular-nums text-2xl font-semibold tracking-tight">
                      {formatAmount(balance, d.currency as CurrencyCode)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      de {formatAmount(initial, d.currency as CurrencyCode)} iniciales
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {monthsLeft !== null && monthsLeft > 0 ? (
                      <Badge variant="secondary">{monthsLeft} meses restantes</Badge>
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
                <div>
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
