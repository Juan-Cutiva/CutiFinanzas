'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { formatAmount } from '@/lib/format';
import type { CurrencyCode } from '@/lib/money';

export interface BudgetWithSpent {
  id: string;
  amountMinor: bigint;
  currency: string;
  spentMinor: number;
  category: { name: string; color: string };
}

export function BudgetList({ items }: { items: BudgetWithSpent[] }) {
  return (
    <div className="grid gap-3">
      {items.map((b) => {
        const planned = Number(b.amountMinor) / 100;
        const spent = b.spentMinor / 100;
        const pct = planned > 0 ? Math.min(150, Math.round((spent / planned) * 100)) : 0;
        const tone = pct > 100 ? 'destructive' : pct >= 80 ? 'warning' : 'ok';

        return (
          <Card key={b.id}>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: b.category.color }}
                    aria-hidden
                  />
                  <span className="text-sm font-medium">{b.category.name}</span>
                </div>
                <span className="font-mono tabular-nums text-sm">
                  {formatAmount(spent, b.currency as CurrencyCode)}
                  <span className="text-muted-foreground">
                    {' / '}
                    {formatAmount(planned, b.currency as CurrencyCode)}
                  </span>
                </span>
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
  );
}
