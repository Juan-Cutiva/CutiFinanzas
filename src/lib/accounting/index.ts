import 'server-only';

/**
 * Motor único de contabilidad — server-only.
 *
 * Para tipos/utilidades reutilizables en el cliente (kinds, períodos, deltas, virtuals)
 * importa desde `@/lib/accounting/shared`.
 */

export {
  type AccountWithBalance,
  getProjectedBalanceMinor,
  getRealBalanceMinor,
  listAccountsWithBalances,
} from './balance';
export { type CreditCardState, getCreditCardState } from './credit-card';
export { type DebtState, getDebtState, listDebtsWithState } from './debt';
export { getSavingsGoalState, listSavingsGoalsWithState, type SavingsGoalState } from './savings';
// Re-exports compartidos (mismo origen) para conveniencia en código server.
export * from './shared';
export { getCategoryExpenseTotals, getPeriodTotals, type PeriodTotals } from './totals';
