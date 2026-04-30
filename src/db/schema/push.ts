import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users';

export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull(),
    p256dh: text('p256dh').notNull(),
    authKey: text('auth_key').notNull(),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (t) => [index('idx_push_user').on(t.userId), uniqueIndex('uniq_push_endpoint').on(t.endpoint)],
);

export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;
