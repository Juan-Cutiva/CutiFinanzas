import dayjs from 'dayjs';
import { and, eq, lte, sql } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { debts, recurringRules, savingsGoals, transactions } from '@/db/schema';
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
      // Idempotente: el unique index (recurring_rule_id, occurred_at) evita
      // duplicados si el cron corre dos veces o si togglePaid ya creó la
      // fila. Los ajustes de balance solo se aplican si efectivamente se
      // insertó una fila nueva.
      const inserted = await db
        .insert(transactions)
        .values({
          userId: rule.userId,
          accountId: rule.accountId,
          transferAccountId: rule.transferAccountId ?? null,
          categoryId: rule.categoryId ?? null,
          debtId: rule.debtId ?? null,
          savingsGoalId: rule.savingsGoalId ?? null,
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
        })
        .onConflictDoNothing({
          target: [transactions.recurringRuleId, transactions.occurredAt],
        })
        .returning({ id: transactions.id });

      if (inserted.length > 0) {
        if (rule.kind === 'debt_payment' && rule.debtId) {
          await db
            .update(debts)
            .set({
              currentBalanceMinor: sql`GREATEST(0::bigint, ${debts.currentBalanceMinor} - ${(rule.amountMinor as bigint).toString()}::bigint)`,
              paidInstallments: sql`${debts.paidInstallments} + 1`,
              updatedAt: sql`now()`,
            })
            .where(and(eq(debts.userId, rule.userId), eq(debts.id, rule.debtId)));
        }
        if (rule.kind === 'savings_contribution' && rule.savingsGoalId) {
          await db
            .update(savingsGoals)
            .set({
              currentAmountMinor: sql`${savingsGoals.currentAmountMinor} + ${(rule.amountMinor as bigint).toString()}::bigint`,
              updatedAt: sql`now()`,
            })
            .where(
              and(eq(savingsGoals.userId, rule.userId), eq(savingsGoals.id, rule.savingsGoalId)),
            );
        }
        created++;
      }

      cursor = nextOccurrence(cursor, rule.dayOfMonth);
    }

    await db
      .update(recurringRules)
      .set({ nextOccurrenceDate: cursor, updatedAt: sql`now()` })
      .where(eq(recurringRules.id, rule.id));
  }

  return NextResponse.json({ ok: true, created, dueCount: due.length });
}
