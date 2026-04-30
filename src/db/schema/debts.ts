import { sql } from 'drizzle-orm';
import {
  bigint,
  char,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import { accounts } from './accounts';
import { debtStatus } from './enums';
import { users } from './users';

export const debts = pgTable(
  'debts',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: text('account_id').references(() => accounts.id, { onDelete: 'set null' }),
    name: varchar('name', { length: 200 }).notNull(),
    initialAmountMinor: bigint('initial_amount_minor', { mode: 'bigint' }).notNull(),
    currentBalanceMinor: bigint('current_balance_minor', { mode: 'bigint' }).notNull(),
    currency: char('currency', { length: 3 }).notNull(),
    interestRateAnnual: numeric('interest_rate_annual', { precision: 7, scale: 4 }),
    monthlyPaymentMinor: bigint('monthly_payment_minor', { mode: 'bigint' }).notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date'),
    totalInstallments: integer('total_installments'),
    paidInstallments: integer('paid_installments').notNull().default(0),
    status: debtStatus('status').notNull().default('active'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [index('idx_debts_user_status').on(t.userId, t.status)],
);

export type DebtRow = typeof debts.$inferSelect;
export type NewDebt = typeof debts.$inferInsert;
