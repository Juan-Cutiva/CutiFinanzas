'use client';

import { ExternalLink, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatAmount, formatDate } from '@/lib/format';
import type { CurrencyCode } from '@/lib/money';
import { isExpenseKind, isIncomeKind } from '../domain';
import { TX_KIND_LABELS } from '../schema';

export interface ViewableTx {
  id: string;
  kind: string;
  amountMinor: bigint;
  currency: string;
  occurredAt: string;
  description: string | null;
  notes: string | null;
  receiptUrl: string | null;
  isRecurring: boolean;
  account: { name: string } | null;
  transferAccount: { name: string } | null;
  category: { name: string; color: string } | null;
}

interface Props {
  tx: ViewableTx | null;
  onClose: () => void;
}

export function ViewTransactionDialog({ tx, onClose }: Props) {
  if (!tx) return null;

  const expense = isExpenseKind(tx.kind);
  const income = isIncomeKind(tx.kind);
  const transfer = tx.kind === 'transfer' || tx.kind === 'credit_card_payment';
  const amountMajor = Number(tx.amountMinor) / 100;
  const displayAmount = expense ? -amountMajor : amountMajor;
  const isVirtual = tx.id.startsWith('virtual:');
  const isImage = tx.receiptUrl && /\.(jpe?g|png|webp|heic|gif|avif)(\?.*)?$/i.test(tx.receiptUrl);

  return (
    <Dialog open={!!tx} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="truncate">
            {tx.description || tx.category?.name || 'Movimiento'}
          </DialogTitle>
          <DialogDescription>
            {formatDate(tx.occurredAt, 'D [de] MMMM YYYY')} ·{' '}
            {TX_KIND_LABELS[tx.kind as keyof typeof TX_KIND_LABELS] ?? tx.kind}
            {isVirtual ? ' · programado' : ''}
            {tx.isRecurring && !isVirtual ? ' · recurrente' : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Monto</p>
            <p
              className={`font-mono tabular-nums text-3xl font-semibold tracking-tight ${
                income
                  ? 'text-amount-positive'
                  : expense
                    ? 'text-amount-negative'
                    : 'text-foreground'
              }`}
            >
              {formatAmount(displayAmount, tx.currency as CurrencyCode, {
                signDisplay: income || expense ? 'always' : 'auto',
              })}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t pt-3 text-sm">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">
                {transfer ? 'Cuenta origen' : 'Cuenta'}
              </p>
              <p className="truncate font-medium">{tx.account?.name ?? '—'}</p>
            </div>
            {transfer && tx.transferAccount ? (
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Cuenta destino</p>
                <p className="truncate font-medium">{tx.transferAccount.name}</p>
              </div>
            ) : null}
            {tx.category && !transfer ? (
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Categoría</p>
                <p className="flex items-center gap-1.5 truncate font-medium">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: tx.category.color }}
                    aria-hidden
                  />
                  {tx.category.name}
                </p>
              </div>
            ) : null}
          </div>

          {tx.description ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Descripción</p>
              <p className="mt-1 text-sm">{tx.description}</p>
            </div>
          ) : null}

          {tx.notes ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Notas</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{tx.notes}</p>
            </div>
          ) : null}

          {tx.receiptUrl ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Comprobante</p>
              {isImage ? (
                <a
                  href={tx.receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 block overflow-hidden rounded-lg border border-border/60"
                >
                  {/* biome-ignore lint/performance/noImgElement: external blob url */}
                  <img
                    src={tx.receiptUrl}
                    alt="Comprobante"
                    className="max-h-72 w-full object-contain bg-muted/30"
                  />
                </a>
              ) : (
                <a
                  href={tx.receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm hover:bg-muted/60"
                >
                  <FileText className="size-4" aria-hidden />
                  Ver archivo adjunto
                  <ExternalLink className="size-3" aria-hidden />
                </a>
              )}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
