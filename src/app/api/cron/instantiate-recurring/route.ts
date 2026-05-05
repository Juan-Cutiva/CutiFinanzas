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

  const today = dayjs().format('YYYY-MM-DD');

  const due = await db.query.recurringRules.findMany({
    where: and(eq(recurringRules.isActive, true), lte(recurringRules.nextOccurrenceDate, today)),
  });

  let created = 0;

  for (const rule of due) {
    let cursor = rule.nextOccurrenceDate;

    while (cursor <= today && (!rule.endDate || cursor <= rule.endDate)) {
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
          transactionDate: cursor,
          description: rule.name,
          notes: rule.notes ?? null,
          recurringRuleId: rule.id,
          isPaid: true,
        })
        .onConflictDoNothing({
          target: [transactions.recurringRuleId, transactions.transactionDate],
        })
        .returning({ id: transactions.id });

      if (inserted.length > 0) created++;
      cursor = nextDate(cursor, rule.frequency, rule.dayOfMonth);
    }

    await db
      .update(recurringRules)
      .set({ nextOccurrenceDate: cursor, updatedAt: sql`now()` })
      .where(eq(recurringRules.id, rule.id));
  }

  return NextResponse.json({ ok: true, created, dueCount: due.length });
}
