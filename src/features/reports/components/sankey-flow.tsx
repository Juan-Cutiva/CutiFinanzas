'use client';

import { formatAmount } from '@/lib/format';
import type { CurrencyCode } from '@/lib/money';

interface FlowItem {
  name: string;
  value: number;
  color: string;
}

interface Props {
  income: number;
  expenses: FlowItem[];
  savings: number;
  currency: CurrencyCode;
}

export function SankeyFlow({ income, expenses, savings, currency }: Props) {
  const totalExpense = expenses.reduce((s, e) => s + e.value, 0);
  const remaining = Math.max(0, income - totalExpense - savings);
  const denominator = Math.max(1, income);

  if (income <= 0) {
    return (
      <p className="text-sm text-muted-foreground">Aún no hay ingresos para mostrar el flujo.</p>
    );
  }

  const rightSlots: FlowItem[] = [
    ...expenses,
    ...(savings > 0 ? [{ name: 'Ahorro', value: savings, color: 'var(--chart-2)' }] : []),
    ...(remaining > 0 ? [{ name: 'Disponible', value: remaining, color: 'var(--chart-4)' }] : []),
  ];

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border/60 bg-card/50 p-4">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="font-semibold">Ingresos</span>
          <span className="font-mono tabular-nums">{formatAmount(income, currency)}</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-[color:var(--income)]">
          <div className="h-full w-full bg-[color:var(--income)]" />
        </div>
      </div>
      <div className="space-y-2">
        {rightSlots.map((item) => {
          const pct = (item.value / denominator) * 100;
          return (
            <div
              key={item.name}
              className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/30 p-3"
            >
              <span
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="flex justify-between text-sm">
                  <span className="truncate font-medium">{item.name}</span>
                  <span className="font-mono tabular-nums">
                    {formatAmount(item.value, currency)}
                  </span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full"
                    style={{
                      backgroundColor: item.color,
                      width: `${Math.min(100, pct)}%`,
                    }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{pct.toFixed(1)}% del ingreso</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
