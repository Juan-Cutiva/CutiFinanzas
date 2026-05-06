'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatAmount } from '@/lib/format';
import type { CurrencyCode } from '@/lib/money';

interface Item {
  name: string;
  value: number;
  color: string;
}

interface Props {
  data: Item[];
  currency: CurrencyCode;
}

export function CategoryChartImpl({ data, currency }: Props) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Sin movimientos para graficar.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 36)}>
      <BarChart layout="vertical" data={data} margin={{ left: 0, right: 16, top: 8, bottom: 8 }}>
        <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis
          type="number"
          tickFormatter={(v: number) => formatAmount(v, currency, { compact: true })}
          stroke="var(--muted-foreground)"
          fontSize={11}
        />
        <YAxis
          dataKey="name"
          type="category"
          width={90}
          stroke="var(--muted-foreground)"
          fontSize={11}
        />
        <Tooltip
          cursor={{ fill: 'oklch(from var(--primary) l c h / 0.1)' }}
          formatter={(value) => formatAmount(typeof value === 'number' ? value : 0, currency)}
          contentStyle={{
            background: 'var(--popover)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            color: 'var(--popover-foreground)',
          }}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
