/**
 * Capa fina sobre `lib/accounting` para la feature de cuentas.
 * Re-exporta lo necesario y agrega utilidades específicas de UI.
 */

export { type AccountKind, isAsset } from '@/lib/accounting/shared';

export function isCreditCard(type: string): boolean {
  return type === 'credit_card';
}
