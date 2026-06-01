import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  char,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import { accounts } from './accounts';
import { categories } from './categories';
import { debts } from './debts';
import { recurrenceFrequency, transactionKind } from './enums';
import { savingsGoals } from './savings';
import { users } from './users';

/**
 * Reglas recurrentes versionadas.
 *
 * Patrón "el pasado es inmutable":
 * - Editar una regla activa NO modifica la fila — se cierra (set endDate = última fecha vigente)
 *   y se crea una nueva regla con startDate = primera fecha del cambio. La nueva regla guarda
 *   `supersedesId` apuntando a la cerrada para trazabilidad.
 * - Las transacciones materializadas viven en la tabla `transactions` y son inmutables al
 *   cambio de regla (si quieres editar una ocurrencia puntual, editas la fila concreta).
 *
 * El cron solo materializa las ocurrencias cuya fecha sea ≤ today AND ≥ startDate AND
 * (endDate IS NULL OR fecha ≤ endDate) AND isActive.
 */
export const recurringRules = pgTable(
  'recurring_rules',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Nullable porque `loan_charge` recurrente (p.ej. interés mensual
    // capitalizado) puede no involucrar ninguna cuenta asset. Para los demás
    // kinds el form de zod sigue exigiendo accountId.
    //
    // onDelete='set null' (antes cascade): si el usuario borra una cuenta, las
    // reglas vinculadas pierden la referencia pero NO se borran. Antes, borrar
    // una cuenta auxiliar destruía silenciosamente reglas activas (p.ej. cuota
    // de préstamo) que la usaban como origen. Ahora el zod del form atrapará
    // accountId nulo cuando el kind lo requiera, forzando al usuario a re-vincular.
    accountId: text('account_id').references(() => accounts.id, { onDelete: 'set null' }),
    counterAccountId: text('counter_account_id').references(() => accounts.id, {
      onDelete: 'set null',
    }),
    categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
    debtId: text('debt_id').references(() => debts.id, { onDelete: 'set null' }),
    savingsGoalId: text('savings_goal_id').references(() => savingsGoals.id, {
      onDelete: 'set null',
    }),
    kind: transactionKind('kind').notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(),
    currency: char('currency', { length: 3 }).notNull(),
    frequency: recurrenceFrequency('frequency').notNull(),
    dayOfMonth: integer('day_of_month'),
    // NOTA: dayOfWeek está declarado pero NO se usa para programar ocurrencias.
    // El día de la semana se infiere del `startDate` (que para reglas weekly/biweekly
    // se setea desde el form vía DayOfWeekPicker → nextDateForDayOfWeek). El cron
    // y `generateVirtualOccurrences` avanzan con `add(1|2, 'week')`, preservando
    // automáticamente el día de la semana del startDate. Esta columna queda como
    // metadata informativa (consultable en exports) pero no es la fuente de verdad.
    dayOfWeek: integer('day_of_week'),
    startDate: date('start_date').notNull(),
    endDate: date('end_date'),
    nextOccurrenceDate: date('next_occurrence_date').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    supersedesId: text('supersedes_id'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    index('idx_recurring_user').on(t.userId),
    index('idx_recurring_active').on(t.userId, t.isActive),
    index('idx_recurring_next').on(t.nextOccurrenceDate, t.isActive),
    index('idx_recurring_account').on(t.accountId),
  ],
);

export type RecurringRuleRow = typeof recurringRules.$inferSelect;
export type NewRecurringRule = typeof recurringRules.$inferInsert;
