'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Días de la semana en orden Lunes→Domingo (convención LATAM).
 * `jsDay` corresponde al índice de `Date.getDay()` (0=Domingo, 1=Lunes, …).
 */
const DAYS: ReadonlyArray<{ jsDay: number; label: string }> = [
  { jsDay: 1, label: 'Lunes' },
  { jsDay: 2, label: 'Martes' },
  { jsDay: 3, label: 'Miércoles' },
  { jsDay: 4, label: 'Jueves' },
  { jsDay: 5, label: 'Viernes' },
  { jsDay: 6, label: 'Sábado' },
  { jsDay: 0, label: 'Domingo' },
];

interface Props {
  value?: number;
  onChange?: (jsDay: number) => void;
  id?: string;
}

export function DayOfWeekPicker({ value, onChange, id }: Props) {
  return (
    <Select
      value={value !== undefined ? String(value) : ''}
      onValueChange={(v) => onChange?.(Number.parseInt(v, 10))}
    >
      <SelectTrigger id={id}>
        <SelectValue placeholder="Día de la semana" />
      </SelectTrigger>
      <SelectContent>
        {DAYS.map((d) => (
          <SelectItem key={d.jsDay} value={String(d.jsDay)}>
            {d.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Próxima fecha (YYYY-MM-DD) cuyo día de la semana coincida con `jsDay`,
 * partiendo de `fromIso` (default hoy). Si hoy ya coincide, devuelve hoy.
 */
export function nextDateForDayOfWeek(jsDay: number, fromIso?: string): string {
  const base = fromIso ? new Date(`${fromIso}T00:00:00`) : new Date();
  const today = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const todayDow = today.getDay();
  let diff = jsDay - todayDow;
  if (diff < 0) diff += 7;
  const target = new Date(today);
  target.setDate(today.getDate() + diff);
  return target.toISOString().slice(0, 10);
}
