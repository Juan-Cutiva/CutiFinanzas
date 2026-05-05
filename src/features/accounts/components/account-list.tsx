'use client';

import { CreditCard, PiggyBank, Trash2, Wallet } from 'lucide-react';
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
import { formatAmount } from '@/lib/format';
import type { CurrencyCode } from '@/lib/money';
import { archiveAccountAction } from '../actions';
import { ACCOUNT_TYPE_LABELS, type AccountTypeCode } from '../schema';

export interface AccountWithBalanceItem {
  id: string;
  name: string;
  type: AccountTypeCode;
  currency: string;
  institution: string | null;
  realMinor: bigint;
  projectedMinor: bigint;
  creditLimitMinor: bigint | null;
}

function iconFor(type: AccountTypeCode) {
  if (type === 'credit_card') return CreditCard;
  if (type === 'savings') return PiggyBank;
  return Wallet;
}

export function AccountList({ accounts }: { accounts: AccountWithBalanceItem[] }) {
  const [pendingDelete, setPendingDelete] = useState<AccountWithBalanceItem | null>(null);
  const { execute, isPending } = useAction(archiveAccountAction, {
    onSuccess: () => {
      toast.success('Cuenta archivada');
      setPendingDelete(null);
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'No se pudo archivar'),
  });

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((acc) => {
          const isCC = acc.type === 'credit_card';
          const balance = Number(acc.realMinor) / 100;
          const projected = Number(acc.projectedMinor) / 100;
          const showProjection = balance !== projected;
          const Icon = iconFor(acc.type);
          // Para CC: balance positivo = lo que debes (mostrar en rojo)
          const balanceColor = isCC
            ? balance > 0
              ? 'text-amount-negative'
              : 'text-amount-positive'
            : balance >= 0
              ? 'text-amount-positive'
              : 'text-amount-negative';
          const limitMajor = acc.creditLimitMinor ? Number(acc.creditLimitMinor) / 100 : null;
          const available = isCC && limitMajor !== null ? Math.max(0, limitMajor - balance) : null;

          return (
            <Card
              key={acc.id}
              className="overflow-hidden transition-colors hover:border-primary/40"
            >
              <CardContent className="flex items-start justify-between gap-3 p-0">
                <Link
                  href={`/cuentas/${acc.id}`}
                  className="flex min-w-0 flex-1 items-start gap-3 p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-l-md"
                  aria-label={`Ver detalle de ${acc.name}`}
                >
                  <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold">{acc.name}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <Badge variant="outline" className="font-normal">
                        {ACCOUNT_TYPE_LABELS[acc.type]}
                      </Badge>
                      <span className="font-mono uppercase tracking-wide">{acc.currency}</span>
                      {acc.institution ? (
                        <>
                          <span aria-hidden>·</span>
                          <span className="truncate">{acc.institution}</span>
                        </>
                      ) : null}
                    </div>
                    <p
                      className={`mt-2 font-mono tabular-nums text-base font-semibold ${balanceColor}`}
                    >
                      {formatAmount(balance, acc.currency as CurrencyCode)}
                      {isCC && balance > 0 ? ' debe' : ''}
                    </p>
                    {isCC && available !== null ? (
                      <p className="text-xs text-muted-foreground">
                        Cupo disponible {formatAmount(available, acc.currency as CurrencyCode)}
                      </p>
                    ) : null}
                    {showProjection ? (
                      <p className="text-xs text-muted-foreground">
                        Proyectado fin de mes:{' '}
                        <span className="font-mono tabular-nums">
                          {formatAmount(projected, acc.currency as CurrencyCode)}
                        </span>
                      </p>
                    ) : null}
                  </div>
                </Link>
                <div className="p-3">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Archivar cuenta ${acc.name}`}
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setPendingDelete(acc)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Archivar esta cuenta?</DialogTitle>
            <DialogDescription>
              {pendingDelete?.name} dejará de aparecer en listas, pero las transacciones existentes
              se conservan.
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
              {isPending ? 'Archivando…' : 'Archivar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
