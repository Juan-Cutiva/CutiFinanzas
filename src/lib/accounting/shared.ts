/**
 * Re-exports CLIENT-SAFE del motor contable. Todo lo que aparece aquí debe poder
 * importarse desde un Client Component sin arrastrar 'server-only'.
 *
 * Para queries de BD, importa desde `@/lib/accounting` (server-only).
 */

export { type AccountKind, deltaFor, isAsset, type TxImpactInput } from './delta';
export {
  ALL_KINDS,
  EXPENSE_KINDS,
  INCOME_KINDS,
  INTERNAL_KINDS,
  isExpenseOfMonth,
  isIncomeOfMonth,
  isInternal,
  KIND_LABELS,
  type PrimaryKind,
  type TransactionKind,
} from './kinds';
export {
  lastDayOfMonth,
  type MonthRange,
  monthRange,
  type SubPeriod,
  subPeriodForDate,
  subPeriodsForMonth,
} from './period-bounds';
export {
  type Frequency,
  generateVirtualOccurrences,
  type RecurringRuleForVirtuals,
  type VirtualOccurrence,
} from './virtuals';
