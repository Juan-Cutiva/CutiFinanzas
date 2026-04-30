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
import { transactionKind } from './enums';
import { users } from './users';

export const transactions = pgTable(
  'transactions',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    transferAccountId: text('transfer_account_id').references(() => accounts.id, {
      onDelete: 'set null',
    }),
    categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
    kind: transactionKind('kind').notNull(),
    amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(),
    currency: char('currency', { length: 3 }).notNull(),
    fxRate: varchar('fx_rate', { length: 32 }),
    fxAmountMinor: bigint('fx_amount_minor', { mode: 'bigint' }),
    fxCurrency: char('fx_currency', { length: 3 }),
    occurredAt: date('occurred_at').notNull(),
    description: varchar('description', { length: 200 }),
    notes: text('notes'),
    isPaid: boolean('is_paid').notNull().default(true),
    isRecurring: boolean('is_recurring').notNull().default(false),
    recurringRuleId: text('recurring_rule_id'),
    quincena: integer('quincena'),
    receiptUrl: text('receipt_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    index('idx_tx_user_date').on(t.userId, t.occurredAt),
    index('idx_tx_account').on(t.accountId),
    index('idx_tx_category').on(t.categoryId),
    index('idx_tx_kind').on(t.kind),
    index('idx_tx_recurring').on(t.recurringRuleId),
  ],
);

export type TransactionRow = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
