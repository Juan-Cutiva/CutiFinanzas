'use server';

import dayjs from 'dayjs';
import { and, between, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/db/client';
import { transactions } from '@/db/schema';
import { authedAction } from '@/lib/safe-action';
import { getQuincenaFromIsoDate } from './domain';

export const cloneMonthAction = authedAction
  .metadata({ actionName: 'cloneMonth' })
  .inputSchema(
    z.object({
      sourceYear: z.number().int().min(2000).max(2100),
      sourceMonth: z.number().int().min(1).max(12),
      targetYear: z.number().int().min(2000).max(2100),
      targetMonth: z.number().int().min(1).max(12),
      onlyFixed: z.boolean().default(true),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const sourceFrom = `${parsedInput.sourceYear}-${String(parsedInput.sourceMonth).padStart(2, '0')}-01`;
    const sourceTo = dayjs(sourceFrom).endOf('month').format('YYYY-MM-DD');

    const sourceTxs = await db.query.transactions.findMany({
      where: and(
        eq(transactions.userId, ctx.userId),
        between(transactions.occurredAt, sourceFrom, sourceTo),
      ),
    });

    const filtered = parsedInput.onlyFixed
      ? sourceTxs.filter((t) => t.kind === 'income_fixed' || t.kind === 'expense_fixed')
      : sourceTxs;

    let cloned = 0;

    for (const tx of filtered) {
      const day = Number.parseInt(tx.occurredAt.slice(8, 10), 10);
      const targetMonthStart = dayjs(
        `${parsedInput.targetYear}-${String(parsedInput.targetMonth).padStart(2, '0')}-01`,
      );
      const lastDay = targetMonthStart.endOf('month').date();
      const safeDay = Math.min(day, lastDay);
      const occurredAt = targetMonthStart.date(safeDay).format('YYYY-MM-DD');

      await db.insert(transactions).values({
        userId: ctx.userId,
        accountId: tx.accountId,
        transferAccountId: tx.transferAccountId,
        categoryId: tx.categoryId,
        kind: tx.kind,
        amountMinor: tx.amountMinor,
        currency: tx.currency,
        occurredAt,
        description: tx.description,
        notes: tx.notes,
        isPaid: false,
        isRecurring: tx.isRecurring,
        recurringRuleId: tx.recurringRuleId,
        quincena: getQuincenaFromIsoDate(occurredAt),
      });
      cloned++;
    }

    revalidatePath('/transacciones');
    revalidatePath('/dashboard');
    return { cloned };
  });
