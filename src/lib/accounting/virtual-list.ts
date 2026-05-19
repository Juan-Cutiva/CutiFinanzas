import 'server-only';
import { and, between, eq, isNotNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { recurringRules, transactions } from '@/db/schema';
import type { UserId } from '@/types/ids';
import type { TransactionKind } from './kinds';
import { monthRange } from './period-bounds';
import { generateVirtualOccurrences, type RecurringRuleForVirtuals } from './virtuals';

/**
 * Item virtual enriquecido para mostrarlo en listas (Transacciones / Ingresos / Gastos).
 * NO existe aún en la tabla `transactions` — el cron lo materializará cuando llegue su fecha.
 *
 * Se distingue por `id` con prefijo `virtual:`. La UI lo muestra como "Programado" y
 * no permite editar/borrar/togglear directamente (hay que esperar materialización o
 * editar la regla recurrente).
 */
export interface VirtualTxItem {
  id: string; // `virtual:<ruleId>:<YYYY-MM-DD>`
  kind: TransactionKind;
  amountMinor: bigint;
  currency: string;
  transactionDate: string;
  description: string | null;
  notes: string | null;
  /** Nullable: `loan_charge` puede no involucrar ninguna cuenta asset. */
  accountId: string | null;
  counterAccountId: string | null;
  categoryId: string | null;
  debtId: string | null;
  savingsGoalId: string | null;
  receiptUrl: string | null;
  isPaid: boolean;
  recurringRuleId: string;
  account: { name: string; type: string } | null;
  counterAccount: { name: string } | null;
  category: { name: string; color: string; icon: string } | null;
  debt: { name: string } | null;
  savingsGoal: { name: string } | null;
  isVirtual: true;
}

/**
 * Lista las ocurrencias virtuales (no materializadas) de las reglas recurrentes
 * activas que caerían dentro del mes indicado.
 *
 * Útil para mostrar "qué viene" cuando el usuario navega a un mes futuro.
 */
export async function listVirtualsForMonth(
  userId: UserId,
  year: number,
  month: number,
): Promise<VirtualTxItem[]> {
  const { from, to } = monthRange(year, month);

  // 1. Reglas activas
  const rules = await db.query.recurringRules.findMany({
    where: and(eq(recurringRules.userId, userId), eq(recurringRules.isActive, true)),
    with: {
      account: true,
      counterAccount: true,
      category: true,
      debt: true,
      savingsGoal: true,
    },
  });
  if (rules.length === 0) return [];

  // 2. Set de pares (ruleId, date) ya MATERIALIZADOS en el mes — para no duplicar.
  // Esto cubre los casos donde:
  //   - el cron ya creó la fila pero la regla aún no actualizó nextOccurrenceDate
  //   - el usuario editó una virtual (this_one) y la materializó manualmente
  //   - el usuario creó una recurrente cuya primera ocurrencia ya está en BD
  const materialized = await db
    .select({
      ruleId: transactions.recurringRuleId,
      date: transactions.transactionDate,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        between(transactions.transactionDate, from, to),
        isNotNull(transactions.recurringRuleId),
      ),
    );
  const materializedKeys = new Set<string>();
  for (const m of materialized) {
    if (m.ruleId) materializedKeys.add(`${m.ruleId}:${m.date}`);
  }

  const out: VirtualTxItem[] = [];
  for (const r of rules) {
    const ruleVirt = ruleToVirtual(r);
    const occurrences = generateVirtualOccurrences(ruleVirt, to, from);
    for (const v of occurrences) {
      // Skip si ya hay una transacción real para esa regla y fecha.
      if (materializedKeys.has(`${r.id}:${v.transactionDate}`)) continue;
      out.push({
        id: `virtual:${r.id}:${v.transactionDate}`,
        kind: r.kind as TransactionKind,
        amountMinor: r.amountMinor as bigint,
        currency: r.currency,
        transactionDate: v.transactionDate,
        description: r.name,
        notes: r.notes,
        accountId: r.accountId,
        counterAccountId: r.counterAccountId,
        categoryId: r.categoryId,
        debtId: r.debtId,
        savingsGoalId: r.savingsGoalId,
        receiptUrl: null,
        isPaid: false,
        recurringRuleId: r.id,
        account: r.account ? { name: r.account.name, type: r.account.type } : null,
        counterAccount: r.counterAccount ? { name: r.counterAccount.name } : null,
        category: r.category
          ? { name: r.category.name, color: r.category.color, icon: r.category.icon }
          : null,
        debt: r.debt ? { name: r.debt.name } : null,
        savingsGoal: r.savingsGoal ? { name: r.savingsGoal.name } : null,
        isVirtual: true,
      });
    }
  }
  return out;
}

function ruleToVirtual(r: typeof recurringRules.$inferSelect): RecurringRuleForVirtuals {
  return {
    id: r.id,
    kind: r.kind,
    amountMinor: BigInt(r.amountMinor as unknown as string | number | bigint),
    currency: r.currency,
    frequency: r.frequency as RecurringRuleForVirtuals['frequency'],
    dayOfMonth: r.dayOfMonth,
    dayOfWeek: r.dayOfWeek,
    startDate: r.startDate,
    endDate: r.endDate,
    nextOccurrenceDate: r.nextOccurrenceDate,
    accountId: r.accountId,
    counterAccountId: r.counterAccountId,
    categoryId: r.categoryId,
    debtId: r.debtId,
    savingsGoalId: r.savingsGoalId,
    isActive: r.isActive,
  };
}
