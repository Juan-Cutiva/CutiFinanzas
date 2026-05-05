'use client';

import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { KIND_LABELS, type TransactionKind } from '@/lib/accounting/shared';
import { formatAmount, formatDate } from '@/lib/format';
import type { CurrencyCode } from '@/lib/money';

export interface ViewableTx {
  id: string;
  kind: TransactionKind;
  amountMinor: bigint;
  currency: string;
  transactionDate: string;
  description: string | null;
  notes: string | null;
  receiptUrl: string | null;
  recurringRuleId: string | null;
  account: { name: string } | null;
  counterAccount: { name: string } | null;
  category: { name: string; color: string } | null;
  debt?: { name: string } | null;
  savingsGoal?: { name: string } | null;
}

interface Props {
  tx: ViewableTx | null;
  onClose: () => void;
}

export function ViewTransactionDialog({ tx, onClose }: Props) {
  return (
    <Dialog open={!!tx} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Detalle del movimiento</DialogTitle>
          <DialogDescription>
            {tx ? `${KIND_LABELS[tx.kind]} · ${formatDate(tx.transactionDate)}` : ''}
          </DialogDescription>
        </DialogHeader>

        {tx ? (
          <div className="grid gap-3 text-sm">
            <Field label="Monto">
              <span className="font-mono tabular-nums text-lg font-semibold">
                {formatAmount(Number(tx.amountMinor) / 100, tx.currency as CurrencyCode)}
              </span>
            </Field>
            <Field label="Tipo">
              <span className="flex items-center gap-2">
                {KIND_LABELS[tx.kind]}
                {tx.recurringRuleId ? <Badge variant="secondary">Recurrente</Badge> : null}
              </span>
            </Field>
            <Field label="Fecha">{formatDate(tx.transactionDate, 'dddd D [de] MMMM YYYY')}</Field>
            {tx.account ? <Field label="Cuenta">{tx.account.name}</Field> : null}
            {tx.counterAccount ? (
              <Field label="Contra-cuenta">{tx.counterAccount.name}</Field>
            ) : null}
            {tx.category ? (
              <Field label="Categoría">
                <span className="flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: tx.category.color }}
                    aria-hidden
                  />
                  {tx.category.name}
                </span>
              </Field>
            ) : null}
            {tx.debt ? <Field label="Préstamo">{tx.debt.name}</Field> : null}
            {tx.savingsGoal ? <Field label="Meta">{tx.savingsGoal.name}</Field> : null}
            {tx.description ? <Field label="Descripción">{tx.description}</Field> : null}
            {tx.notes ? (
              <Field label="Notas">
                <span className="whitespace-pre-wrap">{tx.notes}</span>
              </Field>
            ) : null}
            {tx.receiptUrl ? (
              <Field label="Comprobante">
                <a
                  href={tx.receiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Abrir <ExternalLink className="size-3" />
                </a>
              </Field>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-3 border-b border-border/40 py-2 last:border-b-0">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span>{children}</span>
    </div>
  );
}
