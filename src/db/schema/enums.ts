import { pgEnum } from 'drizzle-orm/pg-core';

export const transactionKind = pgEnum('transaction_kind', [
  'income',
  'income_fixed',
  'income_variable',
  'expense_fixed',
  'expense_variable',
  'transfer',
  'debt_payment',
  'savings_contribution',
]);

export const accountType = pgEnum('account_type', [
  'cash',
  'debit',
  'savings',
  'credit_card',
  'loan',
  'investment',
  'other',
]);

export const recurrenceFrequency = pgEnum('recurrence_frequency', [
  'daily',
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'yearly',
]);

export const debtStatus = pgEnum('debt_status', ['active', 'paid_off', 'defaulted']);

export const goalStatus = pgEnum('goal_status', ['active', 'achieved', 'paused', 'cancelled']);

export const budgetPeriod = pgEnum('budget_period', ['monthly', 'quincena_1', 'quincena_2']);
