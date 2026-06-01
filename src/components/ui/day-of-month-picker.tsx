'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Props {
  value?: number;
  onChange?: (day: number) => void;
  id?: string;
}

export function DayOfMonthPicker({ value, onChange, id }: Props) {
  return (
    <Select
      value={value ? String(value) : ''}
      onValueChange={(v) => onChange?.(Number.parseInt(v, 10))}
    >
      <SelectTrigger id={id}>
        <SelectValue placeholder="Día del mes" />
      </SelectTrigger>
      <SelectContent>
        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
          <SelectItem key={d} value={String(d)}>
            Día {d} {d > 28 ? '(en meses cortos se ajusta al último día)' : ''}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Dado un día del mes, calcula la próxima fecha que cumpla ese día,
 * empezando desde la fecha de referencia (usualmente hoy).
 *
 * - Si el día es HOY o futuro dentro de este mes, devuelve esa fecha de ESTE mes.
 * - Si el día ya pasó este mes (estrictamente < hoy), devuelve el día N del próximo mes.
 * - Si el día N no existe en el mes (ej. 31 en febrero), se usa el último día.
 */
export function nextDateForDayOfMonth(dayOfMonth: number, fromIso?: string): string {
  const today = fromIso ? new Date(fromIso) : new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const todayDay = today.getDate();

  let targetYear = year;
  let targetMonth = month;
  // Cambio: `<` en vez de `<=`. Si elegís el día de HOY, el resultado es HOY,
  // no el mismo día del próximo mes (que era contraintuitivo).
  if (dayOfMonth < todayDay) {
    targetMonth += 1;
    if (targetMonth > 11) {
      targetMonth = 0;
      targetYear += 1;
    }
  }

  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  const safeDay = Math.min(dayOfMonth, lastDay);
  const dt = new Date(targetYear, targetMonth, safeDay);
  return dt.toISOString().slice(0, 10);
}
