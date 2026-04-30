import { renderToBuffer } from '@react-pdf/renderer';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import { type NextRequest, NextResponse } from 'next/server';
import { getOrCreateUser } from '@/db/queries/users';
import { type YearlyReportData, YearlyReportPDF } from '@/features/reports/pdf/yearly-report';
import { totalsByMonthForYear } from '@/features/transactions/queries';
import type { CurrencyCode } from '@/lib/money';

dayjs.locale('es');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getOrCreateUser();
  const userId = user.id as never;
  const url = new URL(req.url);
  const year = Number.parseInt(url.searchParams.get('year') ?? String(dayjs().year()), 10);

  const months = await totalsByMonthForYear(userId, year);

  const data: YearlyReportData = {
    year,
    generatedAt: dayjs().format('DD/MM/YYYY'),
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
