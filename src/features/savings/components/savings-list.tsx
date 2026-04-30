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
import { Label } from '@/components/ui/label';
import { MoneyInput } from '@/components/ui/money-input';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatAmount } from '@/lib/format';
import type { CurrencyCode } from '@/lib/money';
import { contributeToGoalAction, deleteSavingsGoalAction } from '../actions';

export interface SavingsGoalItem {
  id: string;
  name: string;
  targetAmountMinor: bigint;
  currentAmountMinor: bigint;
  monthlyContributionMinor: bigint;
  currency: string;
  color: string;
  targetDate: string | null;
}

export interface AccountOption {
  id: string;
  name: string;
  currency: string;
}

interface Props {
  items: SavingsGoalItem[];
  accounts: AccountOption[];
}

export function SavingsList({ items, accounts }: Props) {
  const [contributing, setContributing] = useState<SavingsGoalItem | null>(null);
  const [deleting, setDeleting] = useState<SavingsGoalItem | null>(null);
  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [accountId, setAccountId] = useState<string>('');

  const contribute = useAction(contributeToGoalAction, {
    onSuccess: () => {
      toast.success('Aporte registrado');
      setContributing(null);
      setAmount(undefined);
      setAccountId('');
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Error'),
  });

  const remove = useAction(deleteSavingsGoalAction, {
    onSuccess: () => {
      toast.success('Meta eliminada');
      setDeleting(null);
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Error'),
  });

  function openContribute(g: SavingsGoalItem) {
    const matching = accounts.find((a) => a.currency === g.currency);
    setAccountId(matching?.id ?? '');
    setContributing(g);
  }

  const compatibleAccounts = contributing
    ? accounts.filter((a) => a.currency === contributing.currency)
    : accounts;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((g) => {
          const target = Number(g.targetAmountMinor) / 100;
          const current = Number(g.currentAmountMinor) / 100;
          const monthly = Number(g.monthlyContributionMinor) / 100;
          const pct = target > 0 ? Math.round((current / target) * 100) : 0;
          const reached = pct >= 100;

          return (
            <Card key={g.id}>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
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
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Eliminar meta"
                    onClick={() => setDeleting(g)}
                  >
                    <Trash2 className="size-4 text-muted-foreground" />
                  </Button>
                </div>
                <div>
                  <p className="font-mono tabular-nums text-lg font-semibold">
                    {formatAmount(current, g.currency as CurrencyCode)}
                    <span className="text-sm font-normal text-muted-foreground">
                      {' / '}
                      {formatAmount(target, g.currency as CurrencyCode)}
                    </span>
                  </p>
                  <Progress
                    className="mt-2"
                    value={Math.min(100, pct)}
                    indicatorClassName={reached ? 'bg-[color:var(--success)]' : 'bg-primary'}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {pct}% — aporte {formatAmount(monthly, g.currency as CurrencyCode)}/mes
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => openContribute(g)}
                  disabled={reached}
                >
                  Registrar aporte
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!contributing} onOpenChange={(o) => !o && setContributing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aportar a {contributing?.name}</DialogTitle>
            <DialogDescription>
              Resta del saldo de la cuenta de origen y suma al acumulado de la meta.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="contribute-amount">Monto</Label>
              <MoneyInput
                id="contribute-amount"
                autoFocus
                className="font-mono tabular-nums"
                value={amount}
                onChange={setAmount}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contribute-account">Cuenta de origen</Label>
              {compatibleAccounts.length === 0 ? (
                <p className="text-xs text-destructive">
                  No hay cuentas en {contributing?.currency}. Crea una primero.
                </p>
              ) : (
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger id="contribute-account">
                    <SelectValue placeholder="Selecciona cuenta" />
                  </SelectTrigger>
                  <SelectContent>
                    {compatibleAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} · {a.currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setContributing(null)}>
              Cancelar
            </Button>
            <Button
              disabled={contribute.isPending || !amount || !accountId}
              onClick={() => {
                if (!contributing || !amount || !accountId) return;
                contribute.execute({ id: contributing.id, amount, accountId });
              }}
            >
              {contribute.isPending ? 'Guardando…' : 'Aportar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar esta meta?</DialogTitle>
            <DialogDescription>{deleting?.name}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
