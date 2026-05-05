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
  transactions: many(transactions, { relationName: 'tx_account' }),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(users, { fields: [categories.userId], references: [users.id] }),
  transactions: many(transactions),
  budgets: many(budgets),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, { fields: [transactions.userId], references: [users.id] }),
  account: one(accounts, {
    fields: [transactions.accountId],
    references: [accounts.id],
    relationName: 'tx_account',
  }),
  counterAccount: one(accounts, {
    fields: [transactions.counterAccountId],
    references: [accounts.id],
    relationName: 'tx_counter_account',
  }),
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
  debt: one(debts, {
    fields: [transactions.debtId],
    references: [debts.id],
  }),
  savingsGoal: one(savingsGoals, {
    fields: [transactions.savingsGoalId],
    references: [savingsGoals.id],
  }),
  recurringRule: one(recurringRules, {
    fields: [transactions.recurringRuleId],
    references: [recurringRules.id],
  }),
}));

export const recurringRulesRelations = relations(recurringRules, ({ one, many }) => ({
  user: one(users, { fields: [recurringRules.userId], references: [users.id] }),
  account: one(accounts, { fields: [recurringRules.accountId], references: [accounts.id] }),
  counterAccount: one(accounts, {
    fields: [recurringRules.counterAccountId],
    references: [accounts.id],
    relationName: 'rr_counter_account',
  }),
  category: one(categories, {
    fields: [recurringRules.categoryId],
    references: [categories.id],
  }),
  debt: one(debts, { fields: [recurringRules.debtId], references: [debts.id] }),
  savingsGoal: one(savingsGoals, {
    fields: [recurringRules.savingsGoalId],
    references: [savingsGoals.id],
  }),
  instances: many(transactions),
}));

export const budgetsRelations = relations(budgets, ({ one }) => ({
  user: one(users, { fields: [budgets.userId], references: [users.id] }),
  category: one(categories, { fields: [budgets.categoryId], references: [categories.id] }),
}));

export const debtsRelations = relations(debts, ({ one, many }) => ({
  user: one(users, { fields: [debts.userId], references: [users.id] }),
  payments: many(transactions),
}));

export const savingsGoalsRelations = relations(savingsGoals, ({ one, many }) => ({
  user: one(users, { fields: [savingsGoals.userId], references: [users.id] }),
  account: one(accounts, { fields: [savingsGoals.accountId], references: [accounts.id] }),
  contributions: many(transactions),
}));

export const pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
  user: one(users, { fields: [pushSubscriptions.userId], references: [users.id] }),
}));
