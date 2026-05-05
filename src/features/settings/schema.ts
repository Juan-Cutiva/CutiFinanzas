import { z } from 'zod';

export const updateUserPreferencesSchema = z.object({
  defaultCurrency: z.string().length(3).toUpperCase().optional(),
  locale: z.string().min(2).max(10).optional(),
  timezone: z.string().min(2).max(64).optional(),
  name: z.string().trim().max(200).optional(),
  /**
   * Días del mes en que cobras (anchors). Determinan los cortes de quincena.
   * Ej: [6, 21] para cobro día 6 y día 21.
   * Vacío o 1 anchor → un solo período (mes completo).
   * 2 anchors → 2 quincenas. N anchors → N períodos.
   */
  payAnchorDates: z.array(z.number().int().min(1).max(31)).min(0).max(4).optional(),
});

export type UpdateUserPreferencesInput = z.infer<typeof updateUserPreferencesSchema>;

export const COMMON_TIMEZONES = [
  'America/Bogota',
  'America/Lima',
  'America/Mexico_City',
  'America/Buenos_Aires',
  'America/Santiago',
  'America/Caracas',
  'America/Sao_Paulo',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/Madrid',
  'Europe/London',
  'UTC',
] as const;

export const COMMON_LOCALES = [
  { code: 'es-CO', label: 'Español (Colombia)' },
  { code: 'es-MX', label: 'Español (México)' },
  { code: 'es-AR', label: 'Español (Argentina)' },
  { code: 'es-CL', label: 'Español (Chile)' },
  { code: 'es-PE', label: 'Español (Perú)' },
  { code: 'es-ES', label: 'Español (España)' },
  { code: 'en-US', label: 'English (US)' },
] as const;
