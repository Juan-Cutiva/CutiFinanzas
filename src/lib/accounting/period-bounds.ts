import dayjs from 'dayjs';

/**
 * Períodos del usuario.
 *
 * El usuario configura `payAnchorDates` (ej. `[6, 21]`). Eso parte cada mes en N períodos
 * cuyo borde es el día anchor. Si N=1 el período es mes calendario; si N=2 son quincenas;
 * si N>2 son sub-períodos.
 *
 * Importante: el "mes" siempre es calendario (1 al fin de mes). Lo que se configura es
 * cómo se SUBDIVIDE ese mes en sub-períodos para el dashboard.
 */

export interface MonthRange {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD inclusive
}

export interface SubPeriod {
  index: number; // 0..N-1
  label: string;
  from: string;
  to: string;
}

export function monthRange(year: number, month: number): MonthRange {
  const first = dayjs(`${year}-${String(month).padStart(2, '0')}-01`);
  return {
    from: first.format('YYYY-MM-DD'),
    to: first.endOf('month').format('YYYY-MM-DD'),
  };
}

export function lastDayOfMonth(year: number, month: number): number {
  return dayjs(`${year}-${String(month).padStart(2, '0')}-01`)
    .endOf('month')
    .date();
}

/**
 * Calcula los sub-períodos de un mes según los anchor dates del usuario.
 *
 * Reglas:
 * - Anchor dates se ordenan ascendente y se sanitizan a [1, lastDay].
 * - Cada anchor define el INICIO de un sub-período. El primero del mes empieza el día 1.
 *   Si el primer anchor del usuario no es 1, entonces:
 *     - Período 0: [1 .. primerAnchor - 1]
 *     - Período 1: [primerAnchor .. siguienteAnchor - 1]
 *     - ...
 *     - Último: [últimoAnchor .. lastDay]
 *   Pero conceptualmente esto produce N+1 sub-períodos. Para mantener N períodos por mes
 *   (lo que el usuario espera con sus quincenas), hacemos lo siguiente:
 *     - El primer período va desde día 1 hasta (anchor[1] - 1).
 *     - Los siguientes desde anchor[i] hasta (anchor[i+1] - 1).
 *     - El último desde anchor[N-1] hasta lastDay.
 *   Esto da exactamente N sub-períodos (uno por anchor), donde el primer anchor es solo
 *   un marcador conceptual ("comienza la quincena cuando cobro el día N").
 *
 * Para anchors=[6,21] en un mes de 31 días:
 *   - Período 1 (Quincena 1): 1..20 — del día 1 hasta el día anterior al cobro 21
 *   - Período 2 (Quincena 2): 21..fin-de-mes
 *
 * Nota: el "comienza día 6" es semántico (primer cobro), pero la quincena financiera
 * arranca con el mes. Si el usuario quiere ver "lo que llevo gastado de mi nómina del 6",
 * podría usar otro filtro. Por ahora: dos quincenas, corte en el segundo anchor.
 *
 * Para que esto sea más intuitivo: los períodos son "ventanas entre cobros". Para [6,21]:
 *   - Ventana 1: 21 (mes anterior) .. 5 (este mes) → confuso porque cruza meses.
 *   - Ventana 2: 6 .. 20.
 *   - Ventana 3: 21 .. fin de mes.
 *
 * Decisión simplificada: siempre cortamos el mes calendario en N segmentos donde N es
 * el número de anchors. Los cortes están en los anchors `desde el 2º en adelante`. Para
 * anchors=[6,21]: corte en 21. Resultado: [1..20] y [21..fin].
 * Esto es lo que naturalmente significa "quincena" en LATAM con cobro día 6 y 21.
 */
export function subPeriodsForMonth(
  year: number,
  month: number,
  payAnchorDates: number[],
): SubPeriod[] {
  const last = lastDayOfMonth(year, month);
  const ymPrefix = `${year}-${String(month).padStart(2, '0')}`;
  const fmt = (d: number) => `${ymPrefix}-${String(d).padStart(2, '0')}`;

  const sanitized = (payAnchorDates ?? [])
    .map((d) => Math.max(1, Math.min(last, Math.trunc(d))))
    .filter((d, i, arr) => arr.indexOf(d) === i)
    .sort((a, b) => a - b);

  if (sanitized.length === 0 || sanitized.length === 1) {
    return [
      {
        index: 0,
        label: 'Mes completo',
        from: fmt(1),
        to: fmt(last),
      },
    ];
  }

  const cuts = sanitized.slice(1); // cortes desde el segundo anchor
  const periods: SubPeriod[] = [];
  let start = 1;
  let i = 0;
  for (const cut of cuts) {
    periods.push({
      index: i,
      label: labelForIndex(i, sanitized.length),
      from: fmt(start),
      to: fmt(cut - 1),
    });
    start = cut;
    i++;
  }
  // último segmento
  periods.push({
    index: i,
    label: labelForIndex(i, sanitized.length),
    from: fmt(start),
    to: fmt(last),
  });
  return periods;
}

function labelForIndex(i: number, total: number): string {
  if (total === 2) return i === 0 ? 'Quincena 1' : 'Quincena 2';
  return `Período ${i + 1}`;
}

/**
 * Devuelve el sub-período que contiene una fecha dada.
 */
export function subPeriodForDate(isoDate: string, payAnchorDates: number[]): SubPeriod {
  const d = dayjs(isoDate);
  const subs = subPeriodsForMonth(d.year(), d.month() + 1, payAnchorDates);
  return subs.find((p) => isoDate >= p.from && isoDate <= p.to) ?? subs[0]!;
}
