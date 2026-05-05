/**
 * Helpers contables para deudas (préstamos installment).
 */

export function calculateRemainingMonths(
  currentBalance: number,
  monthlyRate: number,
  monthlyPayment: number,
): number | null {
  if (currentBalance <= 0) return 0;
  if (monthlyPayment <= 0) return null;
  if (monthlyRate <= 0) return Math.ceil(currentBalance / monthlyPayment);
  const ratio = (monthlyRate * currentBalance) / monthlyPayment;
  if (ratio >= 1) return null;
  const n = -Math.log(1 - ratio) / Math.log(1 + monthlyRate);
  return Math.ceil(n);
}

export function annualToMonthlyRate(annualPercent: number | null | undefined): number {
  if (!annualPercent || annualPercent <= 0) return 0;
  return annualPercent / 100 / 12;
}

export function debtProgress(principal: number, currentBalance: number): number {
  if (principal <= 0) return 0;
  return Math.max(0, Math.min(1, (principal - currentBalance) / principal));
}
