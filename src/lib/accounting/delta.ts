import type { TransactionKind } from './kinds';

export type AccountKind = 'cash' | 'checking' | 'savings' | 'credit_card';

/**
 * Indica si una cuenta es asset (cash/checking/savings) o liability (credit_card).
 */
export function isAsset(type: AccountKind): boolean {
  return type !== 'credit_card';
}

/**
 * Datos mínimos de una transacción para calcular su impacto en el balance de una cuenta.
 */
export interface TxImpactInput {
  kind: TransactionKind;
  amountMinor: bigint;
  accountId: string;
  counterAccountId: string | null;
}

/**
 * Calcula el delta (en minor units, con signo) que aplica una transacción al balance
 * de UNA cuenta concreta. Si la transacción no afecta esa cuenta, devuelve 0.
 *
 * REGLAS — todas las amount son positivas en BD; aquí derivamos el signo según rol:
 *
 *   accountId = source de la transacción (la "principal")
 *     - expense, transfer, cc_payment, loan_payment, savings_contribution → -amount
 *     - income, refund                                                    → +amount
 *     - cc_charge (la account es la CC)                                   → +amount (deuda crece)
 *
 *   counterAccountId = destino (sólo para transfer, cc_payment)
 *     - transfer  (counter = destino asset)                               → +amount
 *     - cc_payment (counter = CC destino)                                 → -amount (deuda baja)
 */
export function deltaFor(tx: TxImpactInput, accountId: string): bigint {
  if (tx.accountId === accountId) {
    switch (tx.kind) {
      case 'expense':
      case 'transfer':
      case 'cc_payment':
      case 'loan_payment':
      case 'savings_contribution':
        return -tx.amountMinor;
      case 'income':
      case 'refund':
      case 'cc_charge':
        return tx.amountMinor;
    }
  }
  if (tx.counterAccountId === accountId) {
    switch (tx.kind) {
      case 'transfer':
        return tx.amountMinor;
      case 'cc_payment':
        return -tx.amountMinor;
      default:
        return 0n;
    }
  }
  return 0n;
}
