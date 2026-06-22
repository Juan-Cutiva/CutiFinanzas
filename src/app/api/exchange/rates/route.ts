import { auth } from '@clerk/nextjs/server';
import { type NextRequest, NextResponse } from 'next/server';
import { getRatesTable } from '@/lib/exchange';
import { type CurrencyCode, SUPPORTED_CURRENCIES } from '@/lib/money';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPPORTED = new Set<string>(SUPPORTED_CURRENCIES.map((c) => c.code));

/**
 * Tabla de tasas para una moneda base. La calculadora de /divisas la consume
 * en cliente para no bloquear el render de la página con la API externa.
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const base = req.nextUrl.searchParams.get('base')?.toUpperCase();
  if (!base || !SUPPORTED.has(base)) {
    return NextResponse.json({ error: 'Moneda base inválida' }, { status: 400 });
  }

  try {
    const table = await getRatesTable(base as CurrencyCode);
    return NextResponse.json(table, {
      headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error obteniendo tasas' },
      { status: 502 },
    );
  }
}
