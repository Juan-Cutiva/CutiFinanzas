'use client';

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatAmount } from '@/lib/format';
import type { CurrencyCode } from '@/lib/money';

interface MonthData {
  month: number;
  incomeMinor: number;
  expenseMinor: number;
  balanceMinor: number;
}

const MONTH_LABELS = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

interface Props {
  data: MonthData[];
  currency: CurrencyCode;
}

export function YearlyChart({ data, currency }: Props) {
  const series = data.map((d) => ({
    name: MONTH_LABELS[d.month - 1] ?? '',
    Ingresos: d.incomeMinor / 100,
    Gastos: d.expenseMinor / 100,
    Balance: d.balanceMinor / 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={series} margin={{ left: 8, right: 16, top: 16, bottom: 8 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
        <YAxis
          stroke="var(--muted-foreground)"
          fontSize={11}
          tickFormatter={(v: number) => formatAmount(v, currency, { compact: true })}
        />
        <Tooltip
          formatter={(value) => formatAmount(typeof value === 'number' ? value : 0, currency)}
          contentStyle={{
            background: 'var(--popover)',
            border: '1px solid var(--border)',
            borderRadius: 8,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Ingresos" fill="var(--chart-2)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="Gastos" fill="var(--chart-3)" radius={[3, 3, 0, 0]} />
        <Line type="monotone" dataKey="Balance" stroke="var(--chart-1)" strokeWidth={2} dot />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
