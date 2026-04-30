import { EXCHANGE_API_URL } from './constants';
import type { CurrencyCode } from './money';

interface FrankfurterResponse {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
}

interface CachedRate {
  rate: number;
  fetchedAt: number;
}

const RATE_CACHE: Map<string, CachedRate> = new Map();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const FRANKFURTER_SUPPORTED: ReadonlySet<CurrencyCode> = new Set([
  'USD',
  'EUR',
  'MXN',
  'BRL',
  'GBP',
]);

function cacheKey(from: CurrencyCode, to: CurrencyCode): string {
  return `${from}->${to}`;
}

async function fetchRate(from: CurrencyCode, to: CurrencyCode): Promise<number> {
  if (from === to) return 1;
  const url = `${EXCHANGE_API_URL}/latest?base=${from}&symbols=${to}`;
  const res = await fetch(url, { next: { revalidate: 21600 } });
  if (!res.ok) {
    throw new Error(`No se pudo obtener tipo de cambio (${res.status})`);
  }
  const json = (await res.json()) as FrankfurterResponse;
  const rate = json.rates[to];
  if (typeof rate !== 'number') {
    throw new Error(`Tipo de cambio ${from}→${to} no disponible`);
  }
  return rate;
}

export async function getExchangeRate(from: CurrencyCode, to: CurrencyCode): Promise<number> {
  if (from === to) return 1;

  const fromOk = FRANKFURTER_SUPPORTED.has(from) || from === 'USD' || from === 'EUR';
  const toOk = FRANKFURTER_SUPPORTED.has(to) || to === 'USD' || to === 'EUR';

  if (!fromOk || !toOk) {
    if (FRANKFURTER_SUPPORTED.has(to) && !FRANKFURTER_SUPPORTED.has(from)) {
      const eurFrom = await fetchRate('EUR' as CurrencyCode, from);
      const eurTo = await fetchRate('EUR' as CurrencyCode, to);
      return eurTo / eurFrom;
    }
    if (FRANKFURTER_SUPPORTED.has(from) && !FRANKFURTER_SUPPORTED.has(to)) {
      const eurFrom = await fetchRate('EUR' as CurrencyCode, from);
      const eurTo = await fetchRate('EUR' as CurrencyCode, to);
      return eurTo / eurFrom;
    }
  }

  const key = cacheKey(from, to);
  const cached = RATE_CACHE.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.rate;
  }
  const rate = await fetchRate(from, to);
  RATE_CACHE.set(key, { rate, fetchedAt: Date.now() });
  return rate;
}

export async function convert(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
): Promise<number> {
  const rate = await getExchangeRate(from, to);
  return amount * rate;
}
