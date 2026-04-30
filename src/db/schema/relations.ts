import { relations } from 'drizzle-orm';
import { accounts } from './accounts';
import { budgets } from './budgets';
import { categories } from './categories';
import { debts } from './debts';
import { pushSubscriptions } from './push';
import { recurringRules } from './recurring';
import { savingsGoals } from './savings';
import { transactions } from './transactions';
import { users } from './users';

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  categories: many(categories),
  transactions: many(transactions),
  recurringRules: many(recurringRules),
  budgets: many(budgets),
  debts: many(debts),
  savingsGoals: many(savingsGoals),
  pushSubscriptions: many(pushSubscriptions),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
  transactions: many(transactions),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(users, { fields: [categories.userId], references: [users.id] }),
  transactions: many(transactions),
  budgets: many(budgets),
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: 'parent_child',
  }),
  children: many(categories, { relationName: 'parent_child' }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, { fields: [transactions.userId], references: [users.id] }),
  account: one(accounts, { fields: [transactions.accountId], references: [accounts.id] }),
  transferAccount: one(accounts, {
    fields: [transactions.transferAccountId],
    references: [accounts.id],
    relationName: 'transfer',
  }),
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
  recurringRule: one(recurringRules, {
    fields: [transactions.recurringRuleId],
    references: [recurringRules.id],
  }),
}));

export const recurringRulesRelations = relations(recurringRules, ({ one, many }) => ({
  user: one(users, { fields: [recurringRules.userId], references: [users.id] }),
  account: one(accounts, { fields: [recurringRules.accountId], references: [accounts.id] }),
  category: one(categories, {
    fields: [recurringRules.categoryId],
    references: [categories.id],
  }),
  instances: many(transactions),
}));

export const budgetsRelations = relations(budgets, ({ one }) => ({
  user: one(users, { fields: [budgets.userId], references: [users.id] }),
  category: one(categories, { fields: [budgets.categoryId], references: [categories.id] }),
}));

export const debtsRelations = relations(debts, ({ one }) => ({
  user: one(users, { fields: [debts.userId], references: [users.id] }),
  account: one(accounts, { fields: [debts.accountId], references: [accounts.id] }),
}));

export const savingsGoalsRelations = relations(savingsGoals, ({ one }) => ({
  user: one(users, { fields: [savingsGoals.userId], references: [users.id] }),
  account: one(accounts, { fields: [savingsGoals.accountId], references: [accounts.id] }),
}));

export const pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
  user: one(users, { fields: [pushSubscriptions.userId], references: [users.id] }),
}));
