import { EXCHANGE_API_URL } from './constants';
import type { CurrencyCode } from './money';

/**
 * open.er-api.com — endpoint abierto de ExchangeRate-API.
 * Gratis, sin API key, 160+ monedas (incluye COP y AUD), actualización diaria.
 * Respuesta de /latest/{base}:
 *   { result, base_code, time_last_update_utc, rates: { CODE: number, ... } }
 */
interface ErApiResponse {
  result: 'success' | 'error';
  base_code: string;
  time_last_update_utc?: string;
  time_last_update_unix?: number;
  rates?: Record<string, number>;
  'error-type'?: string;
}

export interface RatesTable {
  base: CurrencyCode;
  rates: Record<string, number>;
  /** ISO de la última actualización publicada por el proveedor. */
  updatedAt: string;
  /** ISO en que nuestro server hizo el fetch. */
  fetchedAt: string;
}

interface CachedTable {
  table: RatesTable;
  cachedAtMs: number;
}

const TABLE_CACHE: Map<CurrencyCode, CachedTable> = new Map();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h — el proveedor actualiza ~1×/día.

/**
 * Tabla completa de tasas para una moneda base (1 base = X de cada moneda).
 * Cacheada en memoria 6h para no golpear la API en cada cálculo.
 */
export async function getRatesTable(base: CurrencyCode): Promise<RatesTable> {
  const cached = TABLE_CACHE.get(base);
  if (cached && Date.now() - cached.cachedAtMs < CACHE_TTL_MS) {
    return cached.table;
  }

  const url = `${EXCHANGE_API_URL}/latest/${base}`;
  // Timeout duro: el proveedor externo no debe colgar nuestro render/route.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let res: Response;
  try {
    res = await fetch(url, { next: { revalidate: 21600 }, signal: controller.signal });
  } catch (e) {
    throw new Error(
      e instanceof Error && e.name === 'AbortError'
        ? 'El servicio de tasas tardó demasiado en responder'
        : 'No se pudo conectar con el servicio de tasas',
    );
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) {
    throw new Error(`No se pudo obtener tipos de cambio (${res.status})`);
  }
  const json = (await res.json()) as ErApiResponse;
  if (json.result !== 'success' || !json.rates) {
    throw new Error(`Proveedor de tipos de cambio falló: ${json['error-type'] ?? 'desconocido'}`);
  }

  const table: RatesTable = {
    base,
    rates: json.rates,
    updatedAt: json.time_last_update_utc
      ? new Date(json.time_last_update_utc).toISOString()
      : new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
  };
  TABLE_CACHE.set(base, { table, cachedAtMs: Date.now() });
  return table;
}

export async function getExchangeRate(from: CurrencyCode, to: CurrencyCode): Promise<number> {
  if (from === to) return 1;
  const table = await getRatesTable(from);
  const rate = table.rates[to];
  if (typeof rate !== 'number') {
    throw new Error(`Tipo de cambio ${from}→${to} no disponible`);
  }
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
