import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  char,
  date,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import { accounts } from './accounts';
import { categories } from './categories';
import { debts } from './debts';
import { transactionKind } from './enums';
import { savingsGoals } from './savings';
import { users } from './users';

/**
 * Tabla única source-of-truth.
 *
 * Reglas por kind (todas las amount son POSITIVAS):
 * | kind                  | accountId           | counterAccountId        | categoryId | debtId | savingsGoalId |
 * | --------------------- | ------------------- | ----------------------- | ---------- | ------ | ------------- |
 * | expense               | asset (sale -)      | —                       | sí         | —      | —             |
 * | income                | asset (entra +)     | —                       | sí         | —      | —             |
 * | refund                | asset (entra +)     | —                       | sí         | —      | —             |
 * | transfer              | asset origen (-)    | asset destino (+)       | —          | —      | —             |
 * | cc_charge             | credit_card (+)     | —                       | sí         | —      | —             |
 * | cc_payment            | asset origen (-)    | credit_card destino (-) | —          | —      | —             |
 * | loan_payment          | asset origen (-)    | —                       | —          | sí     | —             |
 * | loan_charge           | opcional: asset (+) | —                       | —          | sí     | —             |
 * | savings_contribution  | asset origen (-)    | —                       | —          | —      | sí            |
 *
 * - transactionDate (DATE) está en la timezone del usuario; sin TZ en BD.
 * - createdAt (TIMESTAMPTZ) registra la captura real para auditoría.
 * - isPaid=false marca un movimiento programado/pendiente que aún no afecta cuentas (prog).
 */
export const transactions = pgTable(
  'transactions',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Nullable porque `loan_charge` puede no involucrar ninguna cuenta asset
    // (p.ej. intereses capitalizados, multas: la deuda crece sin que salga
    // dinero de ninguna cuenta del usuario). Para todos los demás kinds el
    // accountId sigue siendo obligatorio — la validación se hace en zod.
    accountId: text('account_id').references(() => accounts.id, { onDelete: 'restrict' }),
    counterAccountId: text('counter_account_id').references(() => accounts.id, {
      onDelete: 'restrict',
    }),
    categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
    debtId: text('debt_id').references(() => debts.id, { onDelete: 'set null' }),
    savingsGoalId: text('savings_goal_id').references(() => savingsGoals.id, {
      onDelete: 'set null',
    }),
    kind: transactionKind('kind').notNull(),
    amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(),
    currency: char('currency', { length: 3 }).notNull(),
    transactionDate: date('transaction_date').notNull(),
    description: varchar('description', { length: 200 }),
    notes: text('notes'),
    isPaid: boolean('is_paid').notNull().default(true),
    recurringRuleId: text('recurring_rule_id'),
    receiptUrl: text('receipt_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    index('idx_tx_user_date').on(t.userId, t.transactionDate),
    index('idx_tx_account').on(t.accountId),
    index('idx_tx_counter_account').on(t.counterAccountId),
    index('idx_tx_category').on(t.categoryId),
    index('idx_tx_kind').on(t.kind),
    index('idx_tx_user_kind_date').on(t.userId, t.kind, t.transactionDate),
    index('idx_tx_recurring').on(t.recurringRuleId),
    index('idx_tx_debt').on(t.debtId),
    index('idx_tx_savings_goal').on(t.savingsGoalId),
    // Idempotencia del cron: una sola ocurrencia por (regla, fecha).
    uniqueIndex('uniq_tx_recurring_occurrence')
      .on(t.recurringRuleId, t.transactionDate)
      .where(sql`${t.recurringRuleId} is not null`),
  ],
);

export type TransactionRow = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
