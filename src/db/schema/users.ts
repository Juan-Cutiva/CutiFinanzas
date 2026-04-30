import { sql } from 'drizzle-orm';
import { char, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  clerkId: text('clerk_id').notNull().unique(),
  email: varchar('email', { length: 320 }).notNull(),
  name: varchar('name', { length: 200 }),
  imageUrl: text('image_url'),
  defaultCurrency: char('default_currency', { length: 3 }).notNull().default('COP'),
  locale: varchar('locale', { length: 10 }).notNull().default('es-CO'),
  timezone: varchar('timezone', { length: 64 }).notNull().default('America/Bogota'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export type UserRow = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
