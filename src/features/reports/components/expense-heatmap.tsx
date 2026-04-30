'use client';

import dayjs from 'dayjs';
import { useMemo } from 'react';
import { formatAmount } from '@/lib/format';
import type { CurrencyCode } from '@/lib/money';

interface Props {
  /** key: YYYY-MM-DD, value: monto en centavos */
  data: Record<string, number>;
  year: number;
  month: number;
  currency: CurrencyCode;
}

const WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export function ExpenseHeatmap({ data, year, month, currency }: Props) {
  const cells = useMemo(() => {
    const start = dayjs(`${year}-${String(month).padStart(2, '0')}-01`);
    const lastDay = start.endOf('month').date();
    const days: { iso: string; day: number; weekday: number; total: number }[] = [];
    for (let d = 1; d <= lastDay; d++) {
      const date = start.date(d);
      const iso = date.format('YYYY-MM-DD');
      const weekday = (date.day() + 6) % 7;
      days.push({ iso, day: d, weekday, total: data[iso] ?? 0 });
    }
    return days;
  }, [data, year, month]);

  const max = useMemo(() => {
    let m = 0;
    for (const c of cells) if (c.total > m) m = c.total;
    return m;
  }, [cells]);

  const firstWeekday = cells[0]?.weekday ?? 0;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] text-muted-foreground">
        {WEEKDAY_LABELS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: firstWeekday }, (_, i) => `pad-${firstWeekday}-${i}`).map((id) => (
          <span key={id} aria-hidden />
        ))}
        {cells.map((c) => {
          const ratio = max > 0 ? c.total / max : 0;
          const opacity = c.total === 0 ? 0.06 : 0.25 + ratio * 0.75;
          const major = c.total / 100;
          const label =
            c.total > 0 ? `${c.day}: ${formatAmount(major, currency)}` : `${c.day}: sin gastos`;
          return (
            <div
              key={c.iso}
              title={label}
              role="img"
              aria-label={label}
              className="aspect-square rounded-sm border border-border/40"
              style={{
                backgroundColor: 'var(--primary)',
                opacity,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
