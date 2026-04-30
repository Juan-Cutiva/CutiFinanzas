import { ARS, BRL, CLP, COP, EUR, GBP, MXN, PEN, USD } from '@dinero.js/currencies';
import { add, allocate, type Dinero, dinero, multiply, subtract, toSnapshot } from 'dinero.js';

export type CurrencyCode = 'COP' | 'USD' | 'EUR' | 'MXN' | 'ARS' | 'CLP' | 'PEN' | 'BRL' | 'GBP';

type DineroCurrency = typeof COP;

const CURRENCY_REGISTRY: Record<CurrencyCode, DineroCurrency> = {
  COP,
  USD,
  EUR,
  MXN,
  ARS,
  CLP,
  PEN,
  BRL,
  GBP,
};

export type Money = Dinero<number>;

export interface MoneyInput {
  amount: number;
  currency: CurrencyCode;
}

export interface MoneyStored {
  amountMinor: bigint;
  currency: CurrencyCode;
  scale: number;
}

export function getCurrency(code: CurrencyCode): DineroCurrency {
  const currency = CURRENCY_REGISTRY[code];
  if (!currency) {
    throw new Error(`Moneda no soportada: ${code}`);
  }
  return currency;
}

export function money(amountMinor: number, code: CurrencyCode): Money {
  return dinero({ amount: amountMinor, currency: getCurrency(code) });
}

export function moneyFromMajor(amountMajor: number, code: CurrencyCode): Money {
  const currency = getCurrency(code);
  const base = Array.isArray(currency.base) ? (currency.base[0] ?? 10) : currency.base;
  const factor = base ** currency.exponent;
  return dinero({ amount: Math.round(amountMajor * factor), currency });
}

export function moneyFromStored(stored: MoneyStored): Money {
  const currency = getCurrency(stored.currency);
  return dinero({
    amount: Number(stored.amountMinor),
    currency,
    scale: stored.scale ?? currency.exponent,
  });
}

export function toStored(m: Money): MoneyStored {
  const snap = toSnapshot(m);
  const code = snap.currency.code as CurrencyCode;
  return {
    amountMinor: BigInt(snap.amount),
    currency: code,
    scale: snap.scale,
  };
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return add(a, b);
}

export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return subtract(a, b);
}

export function multiplyMoney(m: Money, factor: number): Money {
  return multiply(m, factor);
}

export function splitMoney(m: Money, ratios: number[]): Money[] {
  return allocate(m, ratios);
}

export function moneyToMajor(m: Money): number {
  const snap = toSnapshot(m);
  const base = Array.isArray(snap.currency.base)
    ? (snap.currency.base[0] ?? 10)
    : snap.currency.base;
  const factor = base ** snap.scale;
  return snap.amount / factor;
}

export function moneyToMinor(m: Money): number {
  return toSnapshot(m).amount;
}

export function moneyCurrency(m: Money): CurrencyCode {
  return toSnapshot(m).currency.code as CurrencyCode;
}

export function isPositive(m: Money): boolean {
  return moneyToMinor(m) > 0;
}

export function isNegative(m: Money): boolean {
  return moneyToMinor(m) < 0;
}

export function isZero(m: Money): boolean {
  return moneyToMinor(m) === 0;
}

function assertSameCurrency(a: Money, b: Money): void {
  const ca = moneyCurrency(a);
  const cb = moneyCurrency(b);
  if (ca !== cb) {
    throw new Error(
      `No se pueden combinar monedas distintas: ${ca} y ${cb}. Convierte primero a una moneda común.`,
    );
  }
}

export const SUPPORTED_CURRENCIES: ReadonlyArray<{
  code: CurrencyCode;
  name: string;
  symbol: string;
}> = [
  { code: 'COP', name: 'Peso colombiano', symbol: '$' },
  { code: 'USD', name: 'Dólar estadounidense', symbol: 'US$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'MXN', name: 'Peso mexicano', symbol: 'MX$' },
  { code: 'ARS', name: 'Peso argentino', symbol: 'AR$' },
  { code: 'CLP', name: 'Peso chileno', symbol: 'CL$' },
  { code: 'PEN', name: 'Sol peruano', symbol: 'S/' },
  { code: 'BRL', name: 'Real brasileño', symbol: 'R$' },
  { code: 'GBP', name: 'Libra esterlina', symbol: '£' },
];
