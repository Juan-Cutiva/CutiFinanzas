import { sql } from 'drizzle-orm';
import {
  bigint,
  char,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import { accountType } from './enums';
import { users } from './users';

export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    type: accountType('type').notNull(),
    currency: char('currency', { length: 3 }).notNull(),
    initialBalanceMinor: bigint('initial_balance_minor', { mode: 'bigint' }).notNull().default(0n),
    creditLimitMinor: bigint('credit_limit_minor', { mode: 'bigint' }),
    statementDay: integer('statement_day'),
    paymentDueDay: integer('payment_due_day'),
    institution: varchar('institution', { length: 100 }),
    icon: varchar('icon', { length: 64 }).notNull().default('Wallet'),
    color: varchar('color', { length: 32 }).notNull().default('var(--chart-1)'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [index('idx_accounts_user').on(t.userId)],
);

export type AccountRow = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
