/**
 * Reglas financieras del modelo de cuentas.
 *
 * - ASSET (cash / debit / savings / investment / other): el saldo positivo
 *   representa lo que tienes. Un ingreso suma, un gasto resta.
 * - LIABILITY (credit_card / loan): el saldo positivo representa lo que
 *   debes. Un gasto con la tarjeta SUMA la deuda, un pago a la tarjeta o
 *   un refund la RESTA.
 *
 * Net worth = SUM(asset.balance) − SUM(liability.balance).
 *
 * Las transferencias y los pagos a tarjeta de crédito mueven plata entre
 * cuentas y NO se cuentan como gasto ni ingreso real (se excluyen del
 * cash flow / presupuestos / reportes).
 */

export type AccountType =
  | 'cash'
  | 'debit'
  | 'savings'
  | 'credit_card'
  | 'loan'
  | 'investment'
  | 'other';

export type AccountClassification = 'asset' | 'liability';

const LIABILITY_TYPES = new Set<AccountType>(['credit_card', 'loan']);

export function classifyAccount(type: AccountType): AccountClassification {
  return LIABILITY_TYPES.has(type) ? 'liability' : 'asset';
}

const INCOME_KINDS = new Set(['income', 'income_fixed', 'income_variable', 'refund']);
const EXPENSE_KINDS = new Set([
  'expense_fixed',
  'expense_variable',
  'debt_payment',
  'savings_contribution',
]);

/**
 * Calcula el delta sobre el balance de una cuenta para una transacción dada.
 *
 * Convención: balance siempre positivo. Para liability, "deuda crece" = positivo.
 *
 * Casos:
 * - expense en asset (pago en efectivo/débito): -amount
 * - expense en liability (compra con tarjeta): +amount (deuda crece)
 * - income en asset (depósito de salario): +amount
 * - income/refund en liability (devolución a la tarjeta): -amount (deuda baja)
 * - transfer:
 *   - cuenta origen asset: -amount
 *   - cuenta origen liability: +amount (raro: usar más cupo)
 *   - cuenta destino asset: +amount
 *   - cuenta destino liability: -amount (pago a tarjeta)
 * - credit_card_payment:
 *   - cuenta origen (asset): -amount
 *   - cuenta destino (liability): -amount (deuda baja)
 */
export function balanceDeltaFor(
  type: AccountType,
  kind: string,
  isOrigin: boolean,
  amount: bigint,
): bigint {
  const classification = classifyAccount(type);

  if (kind === 'transfer') {
    const sign = isOrigin ? -1n : 1n;
    return classification === 'liability' ? -sign * amount : sign * amount;
  }

  if (kind === 'credit_card_payment') {
    if (isOrigin) {
      return classification === 'asset' ? -amount : amount;
    }
    return -amount;
  }

  if (INCOME_KINDS.has(kind)) {
    return classification === 'asset' ? amount : -amount;
  }

  if (EXPENSE_KINDS.has(kind)) {
    return classification === 'asset' ? -amount : amount;
  }

  return 0n;
}

export const ASSET_TYPES: AccountType[] = ['cash', 'debit', 'savings', 'investment', 'other'];
export const LIABILITY_TYPES_LIST: AccountType[] = ['credit_card', 'loan'];

export function isAssetType(type: string): boolean {
  return classifyAccount(type as AccountType) === 'asset';
}

export function isLiabilityType(type: string): boolean {
  return classifyAccount(type as AccountType) === 'liability';
}

/** Tipos de transacción que NO cuentan en cash flow / presupuestos / reportes */
const NON_CASHFLOW_KINDS = new Set(['transfer', 'credit_card_payment']);

export function isCashflowKind(kind: string): boolean {
  return !NON_CASHFLOW_KINDS.has(kind);
}
