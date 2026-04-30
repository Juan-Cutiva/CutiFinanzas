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
import { recurrenceFrequency, transactionKind } from './enums';
import { users } from './users';

export const recurringRules = pgTable(
  'recurring_rules',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
    kind: transactionKind('kind').notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(),
    currency: char('currency', { length: 3 }).notNull(),
    frequency: recurrenceFrequency('frequency').notNull(),
    dayOfMonth: integer('day_of_month'),
    dayOfWeek: integer('day_of_week'),
    startDate: date('start_date').notNull(),
    endDate: date('end_date'),
    nextOccurrenceDate: date('next_occurrence_date').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    index('idx_recurring_user').on(t.userId),
    index('idx_recurring_next').on(t.nextOccurrenceDate, t.isActive),
  ],
);

export type RecurringRuleRow = typeof recurringRules.$inferSelect;
export type NewRecurringRule = typeof recurringRules.$inferInsert;
