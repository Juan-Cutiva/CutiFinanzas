import 'server-only';
import { and, eq, inArray, lte, sql } from 'drizzle-orm';
import { cache } from 'react';
import { db } from '@/db/client';
import { recurringRules, transactions } from '@/db/schema';
import { env } from '@/env';
import { nowInTz } from '@/lib/format';
import type { UserId } from '@/types/ids';
import { nextOccurrence, type RecurrenceFrequencyValue } from './domain';

export interface MaterializeResult {
  created: number;
  errors: Array<{ ruleId: string; message: string }>;
  /** Reglas que SIGUEN vencidas tras la corrida (señal de bug, no de "nada que hacer"). */
  stillOverdue: number;
}

/**
 * Materializa las ocurrencias recurrentes vencidas de UN usuario hasta
 * `today + lookaheadDays`, en la timezone del usuario.
 *
 * Es el núcleo compartido entre:
 *  - el cron diario (que itera todos los usuarios), y
 *  - la materialización lazy on-load (`ensureRecurringMaterialized`),
 *    que hace el sistema self-healing aunque el cron de Vercel falle.
 *
 * Idempotente: el unique index parcial (recurring_rule_id, transaction_date)
 * + onConflictDoNothing evitan duplicados. Avanza `nextOccurrenceDate` por
 * iteración para ser resumible ante caídas a mitad de corrida.
 *
 * BARATO cuando no hay nada vencido: 1 query (find due) y retorna.
 */
export async function materializeDueForUser(
  userId: UserId,
  timezone: string,
  lookaheadDays: number = env.CRON_MATERIALIZE_LOOKAHEAD_DAYS,
): Promise<MaterializeResult> {
  const todayLocal = nowInTz(timezone).format('YYYY-MM-DD');
  const horizon = nowInTz(timezone).add(lookaheadDays, 'day').format('YYYY-MM-DD');

  const due = await db.query.recurringRules.findMany({
    where: and(
      eq(recurringRules.userId, userId),
      eq(recurringRules.isActive, true),
      lte(recurringRules.nextOccurrenceDate, horizon),
    ),
  });

  let created = 0;
  const errors: MaterializeResult['errors'] = [];

  for (const rule of due) {
    let cursor = rule.nextOccurrenceDate;
    while (cursor <= horizon && (!rule.endDate || cursor <= rule.endDate)) {
      const occurDate = cursor;
      const nextCursor = nextOccurrence(
        cursor,
        rule.frequency as RecurrenceFrequencyValue,
        rule.dayOfMonth,
      );
      try {
        const inserted = await db
          .insert(transactions)
          .values({
            userId: rule.userId,
            accountId: rule.accountId,
            counterAccountId: rule.counterAccountId ?? null,
            categoryId: rule.categoryId ?? null,
            debtId: rule.debtId ?? null,
            savingsGoalId: rule.savingsGoalId ?? null,
            kind: rule.kind,
            amountMinor: rule.amountMinor,
            currency: rule.currency,
            transactionDate: occurDate,
            description: rule.name,
            notes: rule.notes ?? null,
            recurringRuleId: rule.id,
            // Las recurrentes materializadas nacen SIN confirmar: el usuario
            // marca el checkbox cuando realmente paga/recibe. isPaid no afecta
            // balances (es solo marca visual), así que esto no cambia cálculos.
            isPaid: false,
          })
          // Index parcial → onConflictDoNothing() sin target (PG rechaza target
          // sin la WHERE clause del índice parcial).
          .onConflictDoNothing()
          .returning({ id: transactions.id });

        if (inserted.length > 0) created++;

        // Persistimos el avance ANTES de seguir: si el siguiente insert falla,
        // la regla ya apunta al cursor siguiente y no reprocesamos lo hecho.
        await db
          .update(recurringRules)
          .set({ nextOccurrenceDate: nextCursor, updatedAt: sql`now()` })
          .where(eq(recurringRules.id, rule.id));

        cursor = nextCursor;
      } catch (err) {
        errors.push({
          ruleId: rule.id,
          message: err instanceof Error ? err.message : String(err),
        });
        break; // Sale de esta regla; continúa con las demás.
      }
    }
  }

  // ¿Quedó algo vencido respecto a HOY (no al horizonte)? Eso sí es anomalía.
  const stillOverdueRows = await db
    .select({ id: recurringRules.id })
    .from(recurringRules)
    .where(
      and(
        eq(recurringRules.userId, userId),
        eq(recurringRules.isActive, true),
        lte(recurringRules.nextOccurrenceDate, todayLocal),
      ),
    );
  // Una regla "vencida" legítima es la cuya nextOccurrenceDate ≤ today pero ya
  // pasó su endDate (no debería materializar más). Filtramos esas.
  let stillOverdue = 0;
  if (stillOverdueRows.length > 0) {
    const ids = stillOverdueRows.map((r) => r.id);
    const rows = await db.query.recurringRules.findMany({
      where: inArray(recurringRules.id, ids),
    });
    stillOverdue = rows.filter((r) => !r.endDate || r.nextOccurrenceDate <= r.endDate).length;
  }

  return { created, errors, stillOverdue };
}

/**
 * Wrapper cacheado por request (React.cache). Materializa lo vencido del usuario
 * actual de forma lazy cuando carga la app. Llamarlo al inicio de las páginas
 * (app) ANTES de leer datos garantiza que las recurrentes vencidas ya estén
 * materializadas (reales, con checkbox) en ese render.
 *
 * Cacheado → corre una sola vez por request aunque varias páginas/layout lo
 * invoquen. Barato en estado estable (1 query si no hay nada vencido).
 */
export const ensureRecurringMaterialized = cache(async function ensureRecurringMaterialized(
  userId: UserId,
  timezone: string,
): Promise<MaterializeResult> {
  // NUNCA debe tumbar la página: la materialización lazy es una mejora de
  // conveniencia, no un paso crítico del render. Si falla (DB lenta, timeout,
  // etc.), la página igual debe cargar; el cron y el próximo load reintentan.
  try {
    return await materializeDueForUser(userId, timezone);
  } catch (err) {
    console.error('[ensureRecurringMaterialized] falló (no crítico):', err);
    return { created: 0, errors: [], stillOverdue: 0 };
  }
});
