import { sql } from 'drizzle-orm';
import {
  bigint,
  char,
  date,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import { accounts } from './accounts';
import { goalStatus } from './enums';
import { users } from './users';

export const savingsGoals = pgTable(
  'savings_goals',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: text('account_id').references(() => accounts.id, { onDelete: 'set null' }),
    name: varchar('name', { length: 200 }).notNull(),
    targetAmountMinor: bigint('target_amount_minor', { mode: 'bigint' }).notNull(),
    currentAmountMinor: bigint('current_amount_minor', { mode: 'bigint' }).notNull().default(0n),
    currency: char('currency', { length: 3 }).notNull(),
    monthlyContributionMinor: bigint('monthly_contribution_minor', { mode: 'bigint' })
      .notNull()
      .default(0n),
    autoAllocatePercent: numeric('auto_allocate_percent', { precision: 5, scale: 2 }),
    startDate: date('start_date').notNull(),
    targetDate: date('target_date'),
    icon: varchar('icon', { length: 64 }).notNull().default('PiggyBank'),
    color: varchar('color', { length: 32 }).notNull().default('var(--chart-2)'),
    status: goalStatus('status').notNull().default('active'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [index('idx_goals_user_status').on(t.userId, t.status)],
);

export type SavingsGoalRow = typeof savingsGoals.$inferSelect;
export type NewSavingsGoal = typeof savingsGoals.$inferInsert;
