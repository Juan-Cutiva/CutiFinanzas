/**
 * Constantes globales de la app — defaults inmutables que NO cambian por entorno.
 * Las preferencias por usuario viven en la tabla `users` (defaultCurrency, locale, timezone).
 * Lo que cambia por entorno (URLs, secretos) vive en `src/env.ts`.
 */

import type { CurrencyCode } from './money';

export const APP_NAME = 'CutiFinanzas';
export const APP_DESCRIPTION =
  'Controla tus finanzas personales: ingresos, gastos, presupuestos, deudas y metas de ahorro.';

export const DEFAULT_CURRENCY: CurrencyCode = 'COP';
export const DEFAULT_LOCALE = 'es-CO';
export const DEFAULT_TIMEZONE = 'America/Bogota';

// open.er-api.com (endpoint abierto de ExchangeRate-API): gratis, sin API key,
// cubre 160+ monedas INCLUYENDO COP y AUD (Frankfurter no tenía COP), con
// actualización diaria y campo de "última actualización". Un GET a /latest/{base}
// devuelve todas las tasas respecto a esa base.
export const EXCHANGE_API_URL = 'https://open.er-api.com/v6';

export const ROUTES = {
  home: '/',
  dashboard: '/dashboard',
  transacciones: '/transacciones',
  cuentas: '/cuentas',
  presupuestos: '/presupuestos',
  deudas: '/deudas',
  ahorros: '/ahorros',
  reportes: '/reportes',
  divisas: '/divisas',
  ajustes: '/ajustes',
  mas: '/mas',
  signIn: '/sign-in',
  signUp: '/sign-up',
  offline: '/offline',
} as const;
