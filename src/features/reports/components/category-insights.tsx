import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatAmount } from '@/lib/format';
import type { CurrencyCode } from '@/lib/money';
import type { CategoryInsight } from '../predictions';

interface Props {
  insights: CategoryInsight[];
  currency: CurrencyCode;
}

export function CategoryInsights({ insights, currency }: Props) {
  if (insights.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Necesitamos al menos un mes de datos para detectar tendencias.
      </p>
    );
  }

  const sorted = [...insights].sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange));

  return (
    <ul className="space-y-2">
      {sorted.map((i) => {
        const Icon = i.status === 'over' ? TrendingUp : i.status === 'under' ? TrendingDown : Minus;
        const variant =
          i.status === 'over' ? 'destructive' : i.status === 'under' ? 'success' : 'outline';
        const label =
          i.status === 'over'
            ? `+${i.pctChange.toFixed(0)}% sobre el promedio`
            : i.status === 'under'
              ? `${i.pctChange.toFixed(0)}% bajo el promedio`
              : 'En línea con el promedio';
        return (
          <li
            key={i.categoryId ?? 'none'}
            className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/30 px-3 py-2"
          >
            <Icon className="size-4 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{i.categoryName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {formatAmount(i.currentMinor / 100, currency)} este mes · promedio{' '}
                {formatAmount(i.averageMinor / 100, currency)}
              </p>
            </div>
            <Badge variant={variant} className="shrink-0">
              {label}
            </Badge>
          </li>
        );
      })}
    </ul>
  );
}
