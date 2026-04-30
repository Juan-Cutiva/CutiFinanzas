import { auth } from '@clerk/nextjs/server';
import { type NextRequest, NextResponse } from 'next/server';
import { getExchangeRate } from '@/lib/exchange';
import type { CurrencyCode } from '@/lib/money';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const from = url.searchParams.get('from')?.toUpperCase() as CurrencyCode | null;
  const to = url.searchParams.get('to')?.toUpperCase() as CurrencyCode | null;

  if (!from || !to) {
    return NextResponse.json({ error: 'from y to requeridos' }, { status: 400 });
  }

  try {
    const rate = await getExchangeRate(from, to);
    return NextResponse.json(
      { from, to, rate, fetchedAt: new Date().toISOString() },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400',
        },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error desconocido' },
      { status: 502 },
    );
  }
}
