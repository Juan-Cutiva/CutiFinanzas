'use client';

import dynamic from 'next/dynamic';
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

// Lazy-load del chart para evitar embeber recharts (~95kB gz) en el SSR. El bundle
// solo se descarga en el cliente cuando este componente se monta.
const CategoryChartImpl = dynamic(
  () => import('./category-chart-impl').then((m) => m.CategoryChartImpl),
  {
    ssr: false,
    loading: () => <div className="h-64 animate-pulse rounded-md bg-muted/40" aria-hidden />,
  },
);

export function CategoryChart(props: Props) {
  return <CategoryChartImpl {...props} />;
}
