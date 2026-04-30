'use client';

import { Trash2, Wallet } from 'lucide-react';
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
import { ACCOUNT_TYPE_LABELS } from '../schema';

export interface AccountWithBalance {
  id: string;
  name: string;
  type: keyof typeof ACCOUNT_TYPE_LABELS;
  currency: string;
  institution: string | null;
  balanceMinor: bigint;
}

export function AccountList({ accounts }: { accounts: AccountWithBalance[] }) {
  const [pendingDelete, setPendingDelete] = useState<AccountWithBalance | null>(null);
  const { execute, isPending } = useAction(archiveAccountAction, {
    onSuccess: () => {
      toast.success('Cuenta archivada');
      setPendingDelete(null);
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? 'No se pudo archivar');
    },
  });

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {accounts.map((acc) => {
          const balance = Number(acc.balanceMinor) / 100;
          const positive = balance >= 0;
          return (
            <Card key={acc.id} className="overflow-hidden">
              <CardContent className="flex items-start justify-between gap-3 p-5">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Wallet className="size-5" aria-hidden />
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
                      className={`mt-2 font-mono tabular-nums text-base font-semibold ${
                        positive ? 'text-amount-positive' : 'text-amount-negative'
                      }`}
                    >
                      {formatAmount(balance, acc.currency as CurrencyCode)}
                    </p>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Archivar cuenta ${acc.name}`}
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => setPendingDelete(acc)}
                >
                  <Trash2 className="size-4" />
                </Button>
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
