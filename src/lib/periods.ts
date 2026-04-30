import dayjs from 'dayjs';

export type PayFrequency = 'weekly' | 'biweekly' | 'monthly';

export interface Period {
  label: string;
  from: string;
  to: string;
}

function isoDate(d: dayjs.Dayjs): string {
  return d.format('YYYY-MM-DD');
}

export function periodsForMonth(year: number, month: number, frequency: PayFrequency): Period[] {
  const monthStart = dayjs(`${year}-${String(month).padStart(2, '0')}-01`);
  const lastDay = monthStart.endOf('month').date();

  if (frequency === 'monthly') {
    return [
      {
        label: 'Mes completo',
        from: isoDate(monthStart),
        to: isoDate(monthStart.endOf('month')),
      },
    ];
  }

  if (frequency === 'biweekly') {
    return [
      {
        label: 'Quincena 1',
        from: isoDate(monthStart),
        to: isoDate(monthStart.date(15)),
      },
      {
        label: 'Quincena 2',
        from: isoDate(monthStart.date(16)),
        to: isoDate(monthStart.date(lastDay)),
      },
    ];
  }

  const periods: Period[] = [];
  const weekStarts = [1, 8, 15, 22];
  for (let i = 0; i < weekStarts.length; i++) {
    const start = weekStarts[i] ?? 1;
    const nextStart = weekStarts[i + 1];
    const end = nextStart ? nextStart - 1 : lastDay;
    periods.push({
      label: `Semana ${i + 1}`,
      from: isoDate(monthStart.date(start)),
      to: isoDate(monthStart.date(end)),
    });
  }
  return periods;
}
