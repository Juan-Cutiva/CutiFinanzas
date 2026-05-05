import 'server-only';
import dayjs from 'dayjs';
import { and, asc, desc, eq, lte, ne, sql, sum } from 'drizzle-orm';
import { cache } from 'react';
import { db } from '@/db/client';
import { debtEvents, debts, recurringRules, transactions } from '@/db/schema';
import type { UserId } from '@/types/ids';

export async function listDebtsByUser(userId: UserId) {
  return db
    .select()
    .from(debts)
    .where(and(eq(debts.userId, userId), ne(debts.status, 'paid_off')))
    .orderBy(asc(debts.endDate), asc(debts.name));
}

export async function getDebtById(userId: UserId, id: string) {
  return db.query.debts.findFirst({ where: and(eq(debts.userId, userId), eq(debts.id, id)) });
}

export async function getDebtPayments(userId: UserId, debtId: string) {
  return db.query.transactions.findMany({
    where: and(eq(transactions.userId, userId), eq(transactions.debtId, debtId)),
    with: { account: true, transferAccount: true, category: true },
    orderBy: (t, { desc }) => [desc(t.occurredAt), desc(t.createdAt)],
    limit: 500,
  });
}

export async function getDebtUsages(userId: UserId, debtId: string) {
  return db
    .select()
    .from(debtEvents)
    .where(and(eq(debtEvents.userId, userId), eq(debtEvents.debtId, debtId)))
    .orderBy(desc(debtEvents.occurredAt), desc(debtEvents.createdAt))
    .limit(200);
}

/**
 * Calcula el saldo proyectado de una deuda al cierre de la fecha indicada.
 *
 * - Para fechas pasadas / today: saldo computado a partir de pagos reales y
 *   usos efectivamente registrados hasta esa fecha. Independiente del
 *   `currentBalanceMinor` almacenado, evitando drift.
 * - Para fechas futuras: agrega también la proyección de pagos recurrentes
 *   activos (debt_payment con debtId apuntando a esta deuda) que ocurrirán
 *   entre hoy y la fecha objetivo.
 */
export const getDebtProjectedBalance = cache(async function getDebtProjectedBalance(
  userId: UserId,
  debtId: string,
  asOfIso: string,
): Promise<{
  initialAmountMinor: bigint;
  paidInstallments: number;
  currentBalanceMinor: bigint;
  totalPaidMinor: bigint;
  totalUsageMinor: bigint;
}> {
  const debt = await db.query.debts.findFirst({
    where: and(eq(debts.userId, userId), eq(debts.id, debtId)),
  });
  if (!debt) {
    return {
      initialAmountMinor: 0n,
      paidInstallments: 0,
      currentBalanceMinor: 0n,
      totalPaidMinor: 0n,
      totalUsageMinor: 0n,
    };
  }

  const [paidRows, usageRows] = await Promise.all([
    db
      .select({
        total: sum(transactions.amountMinor).mapWith(Number),
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.debtId, debtId),
          eq(transactions.kind, 'debt_payment'),
          lte(transactions.occurredAt, asOfIso),
        ),
      ),
    db
      .select({
        total: sum(debtEvents.amountMinor).mapWith(Number),
      })
      .from(debtEvents)
      .where(
        and(
          eq(debtEvents.userId, userId),
          eq(debtEvents.debtId, debtId),
          lte(debtEvents.occurredAt, asOfIso),
        ),
      ),
  ]);

  let totalPaid = BigInt(paidRows[0]?.total ?? 0);
  let installmentCount = Number(paidRows[0]?.count ?? 0);
  const totalUsage = BigInt(usageRows[0]?.total ?? 0);

  // Proyección hacia adelante de pagos recurrentes que aún no son reales.
  const todayIso = dayjs().format('YYYY-MM-DD');
  if (asOfIso > todayIso) {
    const rules = await db.query.recurringRules.findMany({
      where: and(
        eq(recurringRules.userId, userId),
        eq(recurringRules.isActive, true),
        eq(recurringRules.kind, 'debt_payment'),
        eq(recurringRules.debtId, debtId),
        lte(recurringRules.startDate, asOfIso),
      ),
    });

    const realKeys = new Set<string>(
      (
        await db
          .select({
            recurringRuleId: transactions.recurringRuleId,
            occurredAt: transactions.occurredAt,
          })
          .from(transactions)
          .where(
            and(eq(transactions.userId, userId), sql`${transactions.recurringRuleId} is not null`),
          )
      )
        .filter((r) => r.recurringRuleId)
        .map((r) => `${r.recurringRuleId}:${r.occurredAt}`),
    );

    for (const rule of rules) {
      if (rule.frequency !== 'monthly') continue;
      let cursor = dayjs(todayIso);
      if (cursor.isBefore(rule.startDate)) cursor = dayjs(rule.startDate);
      let safety = 36;
      while (cursor.format('YYYY-MM-DD') <= asOfIso) {
        if (safety-- <= 0) break;
        const lastDay = cursor.endOf('month').date();
        const day = Math.min(rule.dayOfMonth ?? cursor.date(), lastDay);
        const dateStr = cursor.date(day).format('YYYY-MM-DD');
        if (
          dateStr > todayIso &&
          dateStr <= asOfIso &&
          dateStr >= rule.startDate &&
          (!rule.endDate || dateStr <= rule.endDate) &&
          !realKeys.has(`${rule.id}:${dateStr}`)
        ) {
          totalPaid += rule.amountMinor as bigint;
          installmentCount += 1;
        }
        cursor = cursor.add(1, 'month').startOf('month');
      }
    }
  }

  const initial = BigInt(debt.initialAmountMinor);
  const balance = initial + totalUsage - totalPaid;
  const clamped = balance < 0n ? 0n : balance;

  return {
    initialAmountMinor: initial,
    paidInstallments: installmentCount,
    currentBalanceMinor: clamped,
    totalPaidMinor: totalPaid,
    totalUsageMinor: totalUsage,
  };
});

/** Lista deudas con saldo proyectado al cierre de la fecha indicada. */
export const listDebtsWithBalanceAsOf = cache(async function listDebtsWithBalanceAsOf(
  userId: UserId,
  asOfIso: string,
) {
  const list = await listDebtsByUser(userId);
  return Promise.all(
    list.map(async (d) => {
      const projection = await getDebtProjectedBalance(userId, d.id, asOfIso);
      return {
        ...d,
        currentBalanceMinor: projection.currentBalanceMinor,
        paidInstallments: projection.paidInstallments,
        initialAmountMinor: projection.initialAmountMinor,
      };
    }),
  );
});
