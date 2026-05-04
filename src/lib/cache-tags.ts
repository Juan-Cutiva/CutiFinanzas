import 'server-only';
import { revalidatePath, revalidateTag } from 'next/cache';
import type { UserId } from '@/types/ids';

/**
 * Convención de tags por usuario. revalidateTag invalida queries cacheadas
 * con cacheTag(...) o unstable_cache({ tags: [...] }).
 *
 * Hoy las páginas son force-dynamic, así que las llamadas de revalidateTag
 * son no-op para esas páginas, pero quedan listas para cuando se cacheen.
 * revalidatePath se sigue invocando como red de seguridad mientras tanto.
 */
export const cacheTags = {
  accounts: (userId: UserId) => `user:${userId}:accounts`,
  transactions: (userId: UserId) => `user:${userId}:transactions`,
  transactionsMonth: (userId: UserId, year: number, month: number) =>
    `user:${userId}:tx:${year}-${String(month).padStart(2, '0')}`,
  categories: (userId: UserId) => `user:${userId}:categories`,
  budgets: (userId: UserId) => `user:${userId}:budgets`,
  debts: (userId: UserId) => `user:${userId}:debts`,
  savings: (userId: UserId) => `user:${userId}:savings`,
  reports: (userId: UserId) => `user:${userId}:reports`,
};

const PROFILE = 'max';

/**
 * Invalida los datos del usuario afectados por una mutación de transacción.
 * Combina tags (futuro) + paths (presente) para garantizar refresco inmediato.
 */
export function revalidateAfterTransaction(userId: UserId) {
  revalidateTag(cacheTags.transactions(userId), PROFILE);
  revalidateTag(cacheTags.accounts(userId), PROFILE);
  revalidateTag(cacheTags.budgets(userId), PROFILE);
  revalidateTag(cacheTags.debts(userId), PROFILE);
  revalidateTag(cacheTags.savings(userId), PROFILE);
  revalidateTag(cacheTags.reports(userId), PROFILE);
  revalidatePath('/transacciones');
  revalidatePath('/dashboard');
  revalidatePath('/ingresos');
  revalidatePath('/cuentas');
  revalidatePath('/presupuestos');
  revalidatePath('/deudas');
  revalidatePath('/ahorros');
  revalidatePath('/reportes');
}

export function revalidateAfterAccount(userId: UserId) {
  revalidateTag(cacheTags.accounts(userId), PROFILE);
  revalidateTag(cacheTags.transactions(userId), PROFILE);
  revalidatePath('/cuentas');
  revalidatePath('/dashboard');
}

export function revalidateAfterCategory(userId: UserId) {
  revalidateTag(cacheTags.categories(userId), PROFILE);
  revalidatePath('/ajustes');
  revalidatePath('/reportes');
}

export function revalidateAfterBudget(userId: UserId) {
  revalidateTag(cacheTags.budgets(userId), PROFILE);
  revalidatePath('/presupuestos');
  revalidatePath('/dashboard');
}

export function revalidateAfterDebt(userId: UserId) {
  revalidateTag(cacheTags.debts(userId), PROFILE);
  revalidatePath('/deudas');
  revalidatePath('/dashboard');
}

export function revalidateAfterSavings(userId: UserId) {
  revalidateTag(cacheTags.savings(userId), PROFILE);
  revalidatePath('/ahorros');
  revalidatePath('/dashboard');
}
