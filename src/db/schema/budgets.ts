import { sql } from 'drizzle-orm';
import {
  bigint,
  char,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { categories } from './categories';
import { budgetPeriod } from './enums';
import { users } from './users';

export const budgets = pgTable(
  'budgets',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    categoryId: text('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    year: integer('year').notNull(),
    month: integer('month').notNull(),
    period: budgetPeriod('period').notNull().default('monthly'),
    amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(),
    currency: char('currency', { length: 3 }).notNull(),
    rolloverEnabled: integer('rollover_enabled').notNull().default(0),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    index('idx_budgets_user_period').on(t.userId, t.year, t.month),
    uniqueIndex('uniq_budget_per_period').on(t.userId, t.categoryId, t.year, t.month, t.period),
  ],
);

export type BudgetRow = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;
