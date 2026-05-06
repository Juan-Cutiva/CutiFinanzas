import { sql } from 'drizzle-orm';
import { char, integer, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  clerkId: text('clerk_id').notNull().unique(),
  email: varchar('email', { length: 320 }).notNull(),
  name: varchar('name', { length: 200 }),
  imageUrl: text('image_url'),
  defaultCurrency: char('default_currency', { length: 3 }).notNull().default('COP'),
  locale: varchar('locale', { length: 10 }).notNull().default('es-CO'),
  timezone: varchar('timezone', { length: 64 }).notNull().default('America/Bogota'),
  /**
   * Días del mes en que el usuario cobra. Determina los cortes de quincena/período.
   * Default: [6, 21] (cobro el 6 y el 21 de cada mes).
   * - 1 fecha → períodos mensuales con corte ese día.
   * - 2 fechas → quincenas (período entre cobro N y N+1).
   * - N fechas → N períodos por mes.
   */
  payAnchorDates: integer('pay_anchor_dates')
    .array()
    .notNull()
    .default(sql`ARRAY[6, 21]::integer[]`),
  /**
   * ID de la cuenta principal — la que recibe la nómina/ingreso primario.
   * Si está definida, el desglose por quincena en el dashboard solo cuenta
   * los movimientos de ESTA cuenta (mental model "mi quincena"). Si es null,
   * se cuentan todas las cuentas asset.
   */
  primaryAccountId: text('primary_account_id'),
  /**
   * Lista de IDs de cuentas que se muestran en el dashboard (KPI "balance",
   * gráficas, etc). Si está vacía o null, se muestran TODAS las cuentas.
   * Útil para esconder cuentas auxiliares (Nequi de bolsillo, etc).
   */
  dashboardAccountIds: text('dashboard_account_ids').array(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export type UserRow = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
