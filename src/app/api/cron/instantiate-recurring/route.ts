import { eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { recurringRules, users } from '@/db/schema';
import { env } from '@/env';
import { materializeDueForUser } from '@/features/transactions/materialize';
import type { UserId } from '@/types/ids';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Materializa ocurrencias de reglas recurrentes vencidas (hasta hoy + lookahead)
 * para TODOS los usuarios, cada uno en SU timezone.
 *
 * La lógica de materialización vive en `materializeDueForUser` (compartida con
 * la materialización lazy on-load). Idempotente: unique index parcial
 * (recurring_rule_id, transaction_date) + onConflictDoNothing.
 *
 * NO actualiza balances de cuenta/deuda/ahorro — esos son DERIVADOS de
 * transactions (single source of truth).
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (env.CRON_SECRET && authHeader !== `Bearer ${env.CRON_SECRET}`) {
    // Log explícito: distingue "cron mal autenticado" de "nada que hacer".
    console.warn(
      '[cron/instantiate-recurring] 401 — Authorization header no coincide con CRON_SECRET',
    );
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Usuarios DISTINTOS que tienen al menos una regla activa, con su timezone.
  // Materializamos por usuario para respetar su día local (no un "hoy" UTC global).
  const rows = await db
    .selectDistinct({ userId: recurringRules.userId, timezone: users.timezone })
    .from(recurringRules)
    .innerJoin(users, eq(users.id, recurringRules.userId))
    .where(eq(recurringRules.isActive, true));

  let created = 0;
  let stillOverdue = 0;
  const errors: Array<{ ruleId: string; message: string }> = [];

  for (const row of rows) {
    const tz = row.timezone || 'America/Bogota';
    const res = await materializeDueForUser(row.userId as UserId, tz);
    created += res.created;
    stillOverdue += res.stillOverdue;
    errors.push(...res.errors);
  }

  if (stillOverdue > 0) {
    console.warn(
      `[cron/instantiate-recurring] ${stillOverdue} regla(s) siguen vencidas tras la corrida`,
    );
  }

  return NextResponse.json({
    ok: errors.length === 0,
    created,
    userCount: rows.length,
    stillOverdue: stillOverdue > 0 ? stillOverdue : undefined,
    errors: errors.length > 0 ? errors : undefined,
  });
}
