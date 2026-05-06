import { renderToBuffer } from '@react-pdf/renderer';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import { type NextRequest, NextResponse } from 'next/server';
import { getOrCreateUser } from '@/db/queries/users';
import { type YearlyReportData, YearlyReportPDF } from '@/features/reports/pdf/yearly-report';
import { getPeriodTotals, monthRange } from '@/lib/accounting';
import { nowInTz } from '@/lib/format';
import type { CurrencyCode } from '@/lib/money';
import type { UserId } from '@/types/ids';

dayjs.locale('es');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getOrCreateUser();
  const userId = user.id as UserId;
  const url = new URL(req.url);
  const year = Number.parseInt(
    url.searchParams.get('year') ?? String(nowInTz(user.timezone).year()),
    10,
  );

  // 12 totales mensuales en paralelo. Incluye virtuales para los meses que se
  // extienden a futuro respecto a hoy, para que el PDF refleje también los
  // movimientos programados (recurrentes pendientes de materializar).
  const todayIso = nowInTz(user.timezone).format('YYYY-MM-DD');
  const monthList = Array.from({ length: 12 }, (_, i) => i + 1);
  const totalsByMonth = await Promise.all(
    monthList.map((m) => {
      const { from, to } = monthRange(year, m);
      return getPeriodTotals(userId, from, to, {
        includeVirtuals: to > todayIso,
        today: todayIso,
      });
    }),
  );
  const months: YearlyReportData['months'] = totalsByMonth.map((totals, i) => {
    const incomeMinor = Number(totals.incomeMinor);
    const expenseMinor = Number(totals.expenseMinor);
    return {
      month: i + 1,
      incomeMinor,
      expenseMinor,
      balanceMinor: incomeMinor - expenseMinor,
    };
  });

  const data: YearlyReportData = {
    year,
    generatedAt: nowInTz(user.timezone).format('DD/MM/YYYY'),
    currency: user.defaultCurrency as CurrencyCode,
    months,
  };

  const buffer = await renderToBuffer(<YearlyReportPDF data={data} />);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="reporte-anual-${year}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
