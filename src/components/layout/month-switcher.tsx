'use client';

import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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

const MONTH_LABELS_SHORT = [
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

export function MonthSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const search = useSearchParams();
  const [open, setOpen] = useState(false);

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

  const monthShort = MONTH_LABELS_SHORT[monthParam - 1];

  return (
    <div className="flex items-center gap-1">
      <Button
        size="icon"
        variant="ghost"
        aria-label="Mes anterior"
        className="size-8 shrink-0"
        onClick={() => shift(-1)}
      >
        <ChevronLeft className="size-4" />
      </Button>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 px-2 text-sm font-medium tabular-nums sm:hidden"
            aria-label="Cambiar mes"
          >
            <Calendar className="size-4 text-muted-foreground" aria-hidden />
            <span>
              {monthShort} {yearParam}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="center" className="w-auto p-3" sideOffset={6}>
          <div className="flex flex-col gap-2">
            <Select
              value={String(monthParam)}
              onValueChange={(v) => {
                navigate(yearParam, Number.parseInt(v, 10));
                setOpen(false);
              }}
            >
              <SelectTrigger className="h-9 w-40">
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
              onValueChange={(v) => {
                navigate(Number.parseInt(v, 10), monthParam);
                setOpen(false);
              }}
            >
              <SelectTrigger className="h-9 w-40">
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
            {!isCurrent ? (
              <Button
                size="sm"
                variant="outline"
                className="h-9"
                onClick={() => {
                  navigate(now.year(), now.month() + 1);
                  setOpen(false);
                }}
              >
                Ir al mes actual
              </Button>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>

      <div className="hidden items-center gap-1.5 sm:flex">
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
      </div>

      <Button
        size="icon"
        variant="ghost"
        aria-label="Mes siguiente"
        className="size-8 shrink-0"
        onClick={() => shift(1)}
      >
        <ChevronRight className="size-4" />
      </Button>
      {!isCurrent ? (
        <Button
          size="sm"
          variant="outline"
          className="hidden h-9 md:inline-flex"
          onClick={() => navigate(now.year(), now.month() + 1)}
        >
          Hoy
        </Button>
      ) : null}
    </div>
  );
}
