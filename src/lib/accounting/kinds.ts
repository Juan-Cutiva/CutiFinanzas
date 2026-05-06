/**
 * Catálogo de tipos de transacción del sistema, agrupados por su rol contable.
 * Cualquier query que pregunte "¿esto cuenta como gasto del mes?" debe pasar por aquí.
 */

export type TransactionKind =
  | 'expense'
  | 'income'
  | 'refund'
  | 'transfer'
  | 'cc_charge'
  | 'cc_payment'
  | 'loan_payment'
  | 'savings_contribution';

/**
 * Tipos primarios para presentar en formularios. La frecuencia (puntual vs recurrente)
 * y el origen/destino se eligen por aparte.
 */
export type PrimaryKind =
  | 'expense'
  | 'income'
  | 'transfer'
  | 'cc_charge'
  | 'cc_payment'
  | 'loan_payment'
  | 'savings_contribution';

export const ALL_KINDS: TransactionKind[] = [
  'expense',
  'income',
  'refund',
  'transfer',
  'cc_charge',
  'cc_payment',
  'loan_payment',
  'savings_contribution',
];

/**
 * Cuenta como gasto del mes en cash-basis.
 * - expense: gasto directo desde cuenta asset.
 * - cc_payment: pago al banco por la tarjeta de crédito.
 * - loan_payment: cuota de préstamo installment.
 * - savings_contribution: aporte a ahorro (decisión de producto: el dinero
 *   destinado a ahorros se trata como "gastado" desde la perspectiva del
 *   gasto operativo del mes — ya no está disponible para gastar libremente).
 *
 * NO incluye cc_charge (eso solo afecta el saldo de la CC).
 * NO incluye transfer (es movimiento interno entre cuentas asset propias).
 */
export const EXPENSE_KINDS: ReadonlyArray<TransactionKind> = [
  'expense',
  'cc_payment',
  'loan_payment',
  'savings_contribution',
];

/**
 * Cuenta como ingreso del mes.
 */
export const INCOME_KINDS: ReadonlyArray<TransactionKind> = ['income', 'refund'];

/**
 * Movimientos verdaderamente internos entre cuentas propias del usuario —
 * neutros al patrimonio Y al gasto operativo.
 */
export const INTERNAL_KINDS: ReadonlyArray<TransactionKind> = ['transfer', 'cc_charge'];

export function isExpenseOfMonth(kind: TransactionKind): boolean {
  return (EXPENSE_KINDS as readonly TransactionKind[]).includes(kind);
}

export function isIncomeOfMonth(kind: TransactionKind): boolean {
  return (INCOME_KINDS as readonly TransactionKind[]).includes(kind);
}

export function isInternal(kind: TransactionKind): boolean {
  return (INTERNAL_KINDS as readonly TransactionKind[]).includes(kind);
}

/**
 * Etiquetas en español para UI.
 */
export const KIND_LABELS: Record<TransactionKind, string> = {
  expense: 'Gasto',
  income: 'Ingreso',
  refund: 'Devolución',
  transfer: 'Transferencia',
  cc_charge: 'Compra con tarjeta',
  cc_payment: 'Pago de tarjeta',
  loan_payment: 'Cuota de préstamo',
  savings_contribution: 'Aporte a ahorro',
};
