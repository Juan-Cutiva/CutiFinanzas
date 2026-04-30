'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { dayjs } from '@/lib/format';

const MONTH_LABELS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export function MonthSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const search = useSearchParams();

  const now = dayjs();
  const yearParam = Number.parseInt(search.get('y') ?? String(now.year()), 10);
  const monthParam = Number.parseInt(search.get('m') ?? String(now.month() + 1), 10);
  const isCurrent = yearParam === now.year() && monthParam === now.month() + 1;

  const years = useMemo(() => {
    const current = now.year();
    return Array.from({ length: 6 }, (_, i) => current - 2 + i);
  }, [now]);

  function navigate(year: number, month: number) {
    const params = new URLSearchParams(search?.toString() ?? '');
    if (year === now.year() && month === now.month() + 1) {
      params.delete('y');
      params.delete('m');
    } else {
      params.set('y', String(year));
      params.set('m', String(month));
    }
    const qs = params.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ''}`);
  }

  function shift(delta: number) {
    const next = dayjs(`${yearParam}-${String(monthParam).padStart(2, '0')}-01`).add(
      delta,
      'month',
    );
    navigate(next.year(), next.month() + 1);
  }

  return (
    <div className="flex items-center gap-1.5">
      <Button
        size="icon"
        variant="ghost"
        aria-label="Mes anterior"
        className="size-8"
        onClick={() => shift(-1)}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <Select
        value={String(monthParam)}
        onValueChange={(v) => navigate(yearParam, Number.parseInt(v, 10))}
      >
        <SelectTrigger className="h-9 w-32 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MONTH_LABELS.map((m, i) => (
            <SelectItem key={m} value={String(i + 1)}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={String(yearParam)}
        onValueChange={(v) => navigate(Number.parseInt(v, 10), monthParam)}
      >
        <SelectTrigger className="h-9 w-20 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="icon"
        variant="ghost"
        aria-label="Mes siguiente"
        className="size-8"
        onClick={() => shift(1)}
      >
        <ChevronRight className="size-4" />
      </Button>
      {!isCurrent ? (
        <Button
          size="sm"
          variant="outline"
          className="hidden h-9 sm:inline-flex"
          onClick={() => navigate(now.year(), now.month() + 1)}
        >
          Ir al mes actual
        </Button>
      ) : null}
    </div>
  );
}
