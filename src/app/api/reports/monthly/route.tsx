import { renderToBuffer } from '@react-pdf/renderer';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import { type NextRequest, NextResponse } from 'next/server';
import { getOrCreateUser } from '@/db/queries/users';
import { listBudgetsByMonth } from '@/features/budgets/queries';
import { listCategoriesByUser } from '@/features/categories/queries';
import { type MonthlyReportData, MonthlyReportPDF } from '@/features/reports/pdf/monthly-report';
import { totalsByCategoryByMonth, totalsByMonth } from '@/features/transactions/queries';
import type { CurrencyCode } from '@/lib/money';

dayjs.locale('es');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getOrCreateUser();
  const userId = user.id as never;
  const url = new URL(req.url);
  const today = dayjs();
  const year = Number.parseInt(url.searchParams.get('year') ?? String(today.year()), 10);
  const month = Number.parseInt(url.searchParams.get('month') ?? String(today.month() + 1), 10);

  const [totals, categories, budgets, byCategory] = await Promise.all([
    totalsByMonth(userId, year, month),
    listCategoriesByUser(userId),
    listBudgetsByMonth(userId, year, month),
    totalsByCategoryByMonth(userId, year, month),
  ]);

  const data: MonthlyReportData = {
    monthLabel: dayjs(`${year}-${String(month).padStart(2, '0')}-01`).format('MMMM YYYY'),
    generatedAt: dayjs().format('DD/MM/YYYY'),
    currency: user.defaultCurrency as CurrencyCode,
    totals: {
      income: totals.incomeMinor / 100,
      expenseFixed: totals.expenseFixedMinor / 100,
      expenseVariable: totals.expenseVariableMinor / 100,
      debtPayment: totals.debtPaymentMinor / 100,
      savingsContribution: totals.savingsContributionMinor / 100,
    },
    byCategory: categories.map((c) => {
      const planned = Number(budgets.find((b) => b.categoryId === c.id)?.amountMinor ?? 0) / 100;
      const spent = (byCategory.find((b) => b.categoryId === c.id)?.total ?? 0) / 100;
      return { name: c.name, planned, spent };
    }),
  };

  const buffer = await renderToBuffer(<MonthlyReportPDF data={data} />);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="reporte-${year}-${String(month).padStart(2, '0')}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
