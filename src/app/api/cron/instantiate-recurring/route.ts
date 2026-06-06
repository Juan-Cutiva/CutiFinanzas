import dayjs from 'dayjs';
import { and, eq, lte, sql } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { recurringRules, transactions } from '@/db/schema';
import { env } from '@/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Materializa ocurrencias de reglas recurrentes cuya nextOccurrenceDate ≤ hoy.
 *
 * Idempotente: el unique index (recurring_rule_id, transaction_date) evita duplicados.
 * NO actualiza balances de cuenta/deuda/ahorro porque esos son DERIVADOS de transactions
 * (single source of truth).
 */
function nextDate(currentIso: string, frequency: string, dayOfMonth: number | null): string {
  const cur = dayjs(currentIso);
  switch (frequency) {
    case 'weekly':
      return cur.add(1, 'week').format('YYYY-MM-DD');
    case 'biweekly':
      return cur.add(2, 'week').format('YYYY-MM-DD');
    case 'monthly': {
      const next = cur.add(1, 'month');
      const lastDay = next.endOf('month').date();
      const day = Math.min(dayOfMonth ?? next.date(), lastDay);
      return next.date(day).format('YYYY-MM-DD');
    }
    case 'quarterly':
      return cur.add(3, 'month').format('YYYY-MM-DD');
    case 'yearly':
      return cur.add(1, 'year').format('YYYY-MM-DD');
    default:
      return cur.add(1, 'month').format('YYYY-MM-DD');
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (env.CRON_SECRET && authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Horizon = today + LOOKAHEAD. Materializa con anticipación para que el día
  // del cargo el usuario ya tenga la transacción real (no como "programado").
  // Default 1 día — configurable vía env CRON_MATERIALIZE_LOOKAHEAD_DAYS.
  const lookaheadDays = env.CRON_MATERIALIZE_LOOKAHEAD_DAYS;
  const horizon = dayjs().add(lookaheadDays, 'day').format('YYYY-MM-DD');

  const due = await db.query.recurringRules.findMany({
    where: and(eq(recurringRules.isActive, true), lte(recurringRules.nextOccurrenceDate, horizon)),
  });

  let created = 0;
  const errors: Array<{ ruleId: string; message: string }> = [];

  // Por cada regla, materializa una ocurrencia a la vez y actualiza
  // nextOccurrenceDate INMEDIATAMENTE después del insert exitoso. Si la corrida
  // se cae a la mitad (timeout de Vercel, fallo de red), la próxima corrida
  // continúa desde donde quedó, sin reintentar las que ya estaban.
  for (const rule of due) {
    let cursor = rule.nextOccurrenceDate;

    while (cursor <= horizon && (!rule.endDate || cursor <= rule.endDate)) {
      const occurDate = cursor;
      const nextCursor = nextDate(cursor, rule.frequency, rule.dayOfMonth);

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
            isPaid: true,
          })
          // Sin `target` — el unique index es PARTIAL (WHERE recurring_rule_id
          // is not null) y PG rechaza `ON CONFLICT (cols)` sin la WHERE clause
          // correspondiente. `onConflictDoNothing()` plain absorbe cualquier
          // conflict (en la práctica solo el unique parcial podría dispararse
          // por reentrada concurrente o crash entre INSERT y UPDATE).
          .onConflictDoNothing()
          .returning({ id: transactions.id });

        if (inserted.length > 0) created++;

        // Persistimos el avance ANTES de seguir al próximo loop. Si el siguiente
        // insert falla por timeout/red, la regla queda apuntando al cursor
        // siguiente y no reintentamos ocurrencias ya procesadas.
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
        break; // Sale de esta regla; sigue con las demás.
      }
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    created,
    dueCount: due.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
