import { describe, expect, it } from 'vitest';
import { formatAmount } from '@/lib/format';
import {
  addMoney,
  isNegative,
  isPositive,
  isZero,
  moneyFromMajor,
  moneyToMajor,
  moneyToMinor,
  multiplyMoney,
  subtractMoney,
} from '@/lib/money';

describe('money — operaciones básicas', () => {
  it('moneyFromMajor convierte mayor a menor (centavos) sin perder precisión', () => {
    const m = moneyFromMajor(1950000, 'COP');
    expect(moneyToMinor(m)).toBe(195000000);
  });

  it('add suma dos cantidades de la misma moneda', () => {
    const a = moneyFromMajor(1000, 'COP');
    const b = moneyFromMajor(500, 'COP');
    expect(moneyToMajor(addMoney(a, b))).toBe(1500);
  });

  it('subtract resta correctamente', () => {
    const a = moneyFromMajor(1000, 'COP');
    const b = moneyFromMajor(300, 'COP');
    expect(moneyToMajor(subtractMoney(a, b))).toBe(700);
  });

  it('combinar monedas distintas lanza error', () => {
    const cop = moneyFromMajor(1000, 'COP');
    const usd = moneyFromMajor(1, 'USD');
    expect(() => addMoney(cop, usd)).toThrow(/COP/);
  });

  it('multiply factor escalar', () => {
    const m = moneyFromMajor(100, 'COP');
    expect(moneyToMajor(multiplyMoney(m, 3))).toBe(300);
  });

  it('predicados de signo', () => {
    expect(isPositive(moneyFromMajor(1, 'COP'))).toBe(true);
    expect(isNegative(moneyFromMajor(-1, 'COP'))).toBe(true);
    expect(isZero(moneyFromMajor(0, 'COP'))).toBe(true);
  });
});

describe('format — formato es-CO', () => {
  it('COP sin decimales con separador de miles', () => {
    expect(formatAmount(1950000, 'COP')).toBe('$ 1.950.000');
  });

  it('USD con decimales', () => {
    expect(formatAmount(1234.5, 'USD')).toContain('1.234,50');
  });

  it('uso del minus glyph en negativos', () => {
    const out = formatAmount(-100, 'COP');
    expect(out).toContain('−');
    expect(out).not.toContain('-');
  });
});
