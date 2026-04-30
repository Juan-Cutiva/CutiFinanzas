/**
 * Calcula los meses restantes para amortizar una deuda dado balance, tasa
 * mensual (decimal) y pago mensual. Retorna null si el pago no cubre el
 * interés o si los datos son insuficientes.
 *
 * Fórmula NPER (Excel):
 *   n = -ln(1 - r·B/P) / ln(1 + r)
 *
 * Si la tasa es 0, devuelve `ceil(B / P)`.
 */
export function calculateRemainingMonths(
  currentBalance: number,
  monthlyRate: number,
  monthlyPayment: number,
): number | null {
  if (currentBalance <= 0) return 0;
  if (monthlyPayment <= 0) return null;

  if (monthlyRate <= 0) {
    return Math.ceil(currentBalance / monthlyPayment);
  }

  const ratio = (monthlyRate * currentBalance) / monthlyPayment;
  if (ratio >= 1) return null;

  const n = -Math.log(1 - ratio) / Math.log(1 + monthlyRate);
  return Math.ceil(n);
}

export function annualToMonthlyRate(annualPercent: number | null | undefined): number {
  if (!annualPercent || annualPercent <= 0) return 0;
  return annualPercent / 100 / 12;
}

export function debtProgress(initial: number, current: number): number {
  if (initial <= 0) return 0;
  return Math.max(0, Math.min(1, (initial - current) / initial));
}
