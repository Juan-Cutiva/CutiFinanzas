import { describe, expect, it } from 'vitest';
import { DEFAULT_MATERIALIZE_LOOKAHEAD_DAYS, resolveLookaheadDays } from '../domain';

describe('resolveLookaheadDays', () => {
  it('devuelve el default cuando la var no existe (undefined) — caso prod con SKIP_ENV_VALIDATION', () => {
    expect(resolveLookaheadDays(undefined)).toBe(DEFAULT_MATERIALIZE_LOOKAHEAD_DAYS);
  });

  it('devuelve el default con null', () => {
    expect(resolveLookaheadDays(null)).toBe(DEFAULT_MATERIALIZE_LOOKAHEAD_DAYS);
  });

  it('acepta el string crudo de process.env sin coerce de zod', () => {
    expect(resolveLookaheadDays('0')).toBe(0);
    expect(resolveLookaheadDays('2')).toBe(2);
    expect(resolveLookaheadDays('31')).toBe(31);
  });

  it('acepta números ya validados (modo con validación activa)', () => {
    expect(resolveLookaheadDays(0)).toBe(0);
    expect(resolveLookaheadDays(2)).toBe(2);
    expect(resolveLookaheadDays(31)).toBe(31);
  });

  it('cae al default con basura: NaN, no-numérico, fuera de rango, no-entero', () => {
    expect(resolveLookaheadDays('abc')).toBe(DEFAULT_MATERIALIZE_LOOKAHEAD_DAYS);
    expect(resolveLookaheadDays('')).toBe(DEFAULT_MATERIALIZE_LOOKAHEAD_DAYS);
    expect(resolveLookaheadDays(-1)).toBe(DEFAULT_MATERIALIZE_LOOKAHEAD_DAYS);
    expect(resolveLookaheadDays(32)).toBe(DEFAULT_MATERIALIZE_LOOKAHEAD_DAYS);
    expect(resolveLookaheadDays(2.5)).toBe(DEFAULT_MATERIALIZE_LOOKAHEAD_DAYS);
    expect(resolveLookaheadDays(Number.NaN)).toBe(DEFAULT_MATERIALIZE_LOOKAHEAD_DAYS);
  });

  it('el resultado siempre produce un horizon de fecha válido (nunca "Invalid Date")', async () => {
    const { default: dayjs } = await import('dayjs');
    for (const raw of [undefined, null, '2', 'garbage', -5, 99]) {
      const horizon = dayjs('2026-07-08')
        .add(resolveLookaheadDays(raw), 'day')
        .format('YYYY-MM-DD');
      expect(horizon).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
