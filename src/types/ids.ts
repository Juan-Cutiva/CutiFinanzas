declare const __brand: unique symbol;

type Brand<T, B extends string> = T & { readonly [__brand]: B };

export type UserId = Brand<string, 'UserId'>;
export type AccountId = Brand<string, 'AccountId'>;
export type CategoryId = Brand<string, 'CategoryId'>;
export type TransactionId = Brand<string, 'TransactionId'>;
export type BudgetId = Brand<string, 'BudgetId'>;
export type DebtId = Brand<string, 'DebtId'>;
export type SavingsGoalId = Brand<string, 'SavingsGoalId'>;
export type RecurringRuleId = Brand<string, 'RecurringRuleId'>;
export type ReceiptId = Brand<string, 'ReceiptId'>;

export const asUserId = (id: string): UserId => id as UserId;
export const asAccountId = (id: string): AccountId => id as AccountId;
export const asCategoryId = (id: string): CategoryId => id as CategoryId;
export const asTransactionId = (id: string): TransactionId => id as TransactionId;
export const asBudgetId = (id: string): BudgetId => id as BudgetId;
export const asDebtId = (id: string): DebtId => id as DebtId;
export const asSavingsGoalId = (id: string): SavingsGoalId => id as SavingsGoalId;
export const asRecurringRuleId = (id: string): RecurringRuleId => id as RecurringRuleId;
export const asReceiptId = (id: string): ReceiptId => id as ReceiptId;
