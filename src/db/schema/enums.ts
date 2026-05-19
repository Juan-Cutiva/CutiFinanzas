import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Tipos de transacción — single source of truth del libro contable.
 *
 * - expense: gasto real desde una cuenta asset.
 * - income: ingreso a una cuenta asset.
 * - refund: devolución (suma a una cuenta asset, opcionalmente categorizada).
 * - transfer: movimiento entre dos cuentas asset propias (no afecta gasto/ingreso).
 * - cc_charge: compra con tarjeta de crédito (NO es gasto del mes; aumenta saldo de la CC).
 * - cc_payment: pago a la tarjeta de crédito (sale de cuenta asset → reduce saldo CC). Cuenta como gasto del mes (cash-basis).
 * - loan_payment: pago a un préstamo installment (sale de cuenta asset → reduce principal pendiente). Cuenta como gasto del mes.
 * - loan_charge: cargo adicional a un préstamo (intereses capitalizados, multas,
 *   reajustes, o desembolso adicional sobre el mismo crédito). AUMENTA el saldo
 *   pendiente del préstamo. `accountId` opcional: si se llena, esa cuenta RECIBE
 *   el dinero (caso desembolso). No cuenta como gasto ni ingreso del mes.
 * - savings_contribution: aporte a meta de ahorro (sale de cuenta asset → suma al goal).
 */
export const transactionKind = pgEnum('transaction_kind', [
  'expense',
  'income',
  'refund',
  'transfer',
  'cc_charge',
  'cc_payment',
  'loan_payment',
  'loan_charge',
  'savings_contribution',
]);

export const accountType = pgEnum('account_type', ['cash', 'checking', 'savings', 'credit_card']);

export const recurrenceFrequency = pgEnum('recurrence_frequency', [
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'yearly',
]);

export const debtStatus = pgEnum('debt_status', ['active', 'paid_off']);

export const goalStatus = pgEnum('goal_status', ['active', 'achieved', 'paused', 'cancelled']);

export const budgetPeriod = pgEnum('budget_period', ['monthly', 'quincena_1', 'quincena_2']);
