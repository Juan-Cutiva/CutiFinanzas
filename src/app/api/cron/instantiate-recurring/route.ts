import dayjs from 'dayjs';
import { and, eq, lte, sql } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { recurringRules, transactions } from '@/db/schema';
import { env } from '@/env';
import { getQuincenaFromIsoDate } from '@/features/transactions/domain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function nextOccurrence(currentIso: string, dayOfMonth: number | null): string {
  const next = dayjs(currentIso).add(1, 'month');
  const lastDay = next.endOf('month').date();
  const day = Math.min(dayOfMonth ?? next.date(), lastDay);
  return next.date(day).format('YYYY-MM-DD');
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
    const currentDate = rule.nextOccurrenceDate;
    let cursor = currentDate;

    while (cursor <= today && (!rule.endDate || cursor <= rule.endDate)) {
      await db.insert(transactions).values({
        userId: rule.userId,
        accountId: rule.accountId,
        categoryId: rule.categoryId ?? null,
        kind: rule.kind,
        amountMinor: rule.amountMinor,
        currency: rule.currency,
        occurredAt: cursor,
        description: rule.name,
        notes: rule.notes ?? null,
        isPaid: false,
        isRecurring: true,
        recurringRuleId: rule.id,
        quincena: getQuincenaFromIsoDate(cursor),
      });
      created++;
      cursor = nextOccurrence(cursor, rule.dayOfMonth);
    }

    await db
      .update(recurringRules)
      .set({ nextOccurrenceDate: cursor, updatedAt: sql`now()` })
      .where(eq(recurringRules.id, rule.id));
  }

  return NextResponse.json({ ok: true, created, dueCount: due.length });
}
