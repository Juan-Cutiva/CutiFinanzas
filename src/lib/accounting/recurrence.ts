import dayjs from 'dayjs';

export type RecurrenceFrequencyValue = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

/**
 * SINGLE SOURCE OF TRUTH para avanzar una fecha recurrente.
 *
 * Calcula la siguiente ocurrencia a partir de `fromIso`. Para frecuencias
 * mensuales/trimestrales aplica clamp a `dayOfMonth`: si el día objetivo no
 * existe en el mes destino (p.ej. 31 en febrero) usa el último día del mes.
 *
 * CRÍTICO: el cron/materializador, `createTransaction`, `updateRecurring`,
 * `editVirtualOccurrence` y el generador de virtuales (`advance`) DEBEN usar
 * esta función. Si divergen (unos con clamp y otros con `add(1,'month')` plano)
 * las fechas materializadas y las proyectadas se desincronizan para reglas de
 * día 29-31 → huecos o duplicados que el unique index (rule_id, date) no
 * detecta (porque las fechas difieren).
 */
export function nextOccurrence(
  fromIso: string,
  frequency: RecurrenceFrequencyValue,
  dayOfMonth?: number | null,
): string {
  const cur = dayjs(fromIso);
  switch (frequency) {
    case 'weekly':
      return cur.add(1, 'week').format('YYYY-MM-DD');
    case 'biweekly':
      return cur.add(2, 'week').format('YYYY-MM-DD');
    case 'monthly': {
      const next = cur.add(1, 'month');
      const lastDay = next.endOf('month').date();
      const day = Math.min(dayOfMonth ?? cur.date(), lastDay);
      return next.date(day).format('YYYY-MM-DD');
    }
    case 'quarterly': {
      const next = cur.add(3, 'month');
      const lastDay = next.endOf('month').date();
      const day = Math.min(dayOfMonth ?? cur.date(), lastDay);
      return next.date(day).format('YYYY-MM-DD');
    }
    case 'yearly':
      return cur.add(1, 'year').format('YYYY-MM-DD');
  }
}
