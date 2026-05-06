'use client';

import dynamic from 'next/dynamic';
import type { CurrencyCode } from '@/lib/money';

interface MonthData {
  month: number;
  incomeMinor: number;
  expenseMinor: number;
  balanceMinor: number;
}

interface Props {
  data: MonthData[];
  currency: CurrencyCode;
}

// Lazy-load: recharts no se incluye en el bundle inicial; solo se descarga al
// montar este componente en /reportes/anual.
const YearlyChartImpl = dynamic(
  () => import('./yearly-chart-impl').then((m) => m.YearlyChartImpl),
  {
    ssr: false,
    loading: () => <div className="h-75 w-full animate-pulse rounded-md bg-muted/40" aria-hidden />,
  },
);

export function YearlyChart(props: Props) {
  return <YearlyChartImpl {...props} />;
}
