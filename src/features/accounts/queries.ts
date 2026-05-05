import 'server-only';
import dayjs from 'dayjs';
import { and, asc, eq, isNull, lte, or, sql, sum } from 'drizzle-orm';
import { cache } from 'react';
import { db } from '@/db/client';
import { accounts, recurringRules, transactions } from '@/db/schema';
import type { UserId } from '@/types/ids';
import { type AccountType, balanceDeltaFor, classifyAccount } from './domain';

export const listAccountsByUser = cache(async function listAccountsByUser(userId: UserId) {
  return db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), isNull(accounts.archivedAt)))
    .orderBy(asc(accounts.name));
});

export const getAccountById = cache(async function getAccountById(userId: UserId, id: string) {
  return db.query.accounts.findFirst({
    where: and(eq(accounts.userId, userId), eq(accounts.id, id)),
  });
});

export const listAccountsWithBalance = cache(async function listAccountsWithBalance(
  userId: UserId,
) {
  const list = await listAccountsByUser(userId);
  if (list.length === 0) return [];

  const sumsAsAccount = await db
    .select({
      accountId: transactions.accountId,
      kind: transactions.kind,
      total: sum(transactions.amountMinor).mapWith(Number),
    })
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .groupBy(transactions.accountId, transactions.kind);

  const sumsAsTransfer = await db
    .select({
      accountId: transactions.transferAccountId,
      kind: transactions.kind,
      total: sum(transactions.amountMinor).mapWith(Number),
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        or(eq(transactions.kind, 'transfer'), eq(transactions.kind, 'credit_card_payment')),
      ),
    )
    .groupBy(transactions.transferAccountId, transactions.kind);

  return list.map((acc) => {
    let balanceMinor = BigInt(acc.initialBalanceMinor);
    const accountSums = sumsAsAccount.filter((s) => s.accountId === acc.id);
    const destinationSums = sumsAsTransfer.filter((s) => s.accountId === acc.id);

    for (const s of accountSums) {
      const amount = BigInt(s.total ?? 0);
      balanceMinor += balanceDeltaFor(acc.type as AccountType, s.kind, true, amount);
    }
    for (const s of destinationSums) {
      const amount = BigInt(s.total ?? 0);
      balanceMinor += balanceDeltaFor(acc.type as AccountType, s.kind, false, amount);
    }

    return {
      ...acc,
      balanceMinor,
      classification: classifyAccount(acc.type as AccountType),
    };
  });
});

interface ProjectedOccurrence {
  ruleId: string;
  occurredAt: string;
  kind: string;
  amountMinor: bigint;
  accountId: string;
  transferAccountId: string | null;
}

/**
 * Proyecta hacia ADELANTE las ocurrencias virtuales de reglas recurrentes
 * que aún NO existen como filas reales. El intervalo es (today, asOfIso].
 *
 * Para meses pasados, las filas reales (creadas por el cron) ya están en
 * la tabla y se cuentan vía SQL. Para meses futuros, las virtuales se
 * proyectan aquí. Si asOfIso es anterior a today, no proyectamos nada
 * (el pasado se reconstruye solo con datos reales).
 */
async function projectedRecurringUpTo(
  userId: UserId,
  asOfIso: string,
): Promise<ProjectedOccurrence[]> {
  const todayIso = dayjs().format('YYYY-MM-DD');
  if (asOfIso <= todayIso) return [];

  const rules = await db.query.recurringRules.findMany({
    where: and(
      eq(recurringRules.userId, userId),
      eq(recurringRules.isActive, true),
      lte(recurringRules.startDate, asOfIso),
    ),
  });
  if (rules.length === 0) return [];

  const realRows = await db
    .select({
      recurringRuleId: transactions.recurringRuleId,
      occurredAt: transactions.occurredAt,
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), sql`${transactions.recurringRuleId} is not null`));
  const realKeys = new Set(
    realRows.filter((r) => r.recurringRuleId).map((r) => `${r.recurringRuleId}:${r.occurredAt}`),
  );

  const out: ProjectedOccurrence[] = [];
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
        out.push({
          ruleId: rule.id,
          occurredAt: dateStr,
          kind: rule.kind,
          amountMinor: rule.amountMinor as bigint,
          accountId: rule.accountId,
          transferAccountId: rule.transferAccountId ?? null,
        });
      }
      cursor = cursor.add(1, 'month').startOf('month');
    }
  }

  return out;
}

/**
 * Saldo proyectado de cada cuenta al cierre de la fecha indicada.
 * Suma el saldo inicial + transacciones reales hasta esa fecha + ocurrencias
 * virtuales recurrentes que aún no se han materializado pero que ocurrirían
 * en o antes de esa fecha (proyección hacia el futuro).
 */
export const listAccountsWithBalanceAsOf = cache(async function listAccountsWithBalanceAsOf(
  userId: UserId,
  asOfIso: string,
) {
  const list = await listAccountsByUser(userId);
  if (list.length === 0) return [];

  const [sumsAsAccount, sumsAsTransfer, projected] = await Promise.all([
    db
      .select({
        accountId: transactions.accountId,
        kind: transactions.kind,
        total: sum(transactions.amountMinor).mapWith(Number),
      })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), lte(transactions.occurredAt, asOfIso)))
      .groupBy(transactions.accountId, transactions.kind),
    db
      .select({
        accountId: transactions.transferAccountId,
        kind: transactions.kind,
        total: sum(transactions.amountMinor).mapWith(Number),
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          lte(transactions.occurredAt, asOfIso),
          or(eq(transactions.kind, 'transfer'), eq(transactions.kind, 'credit_card_payment')),
        ),
      )
      .groupBy(transactions.transferAccountId, transactions.kind),
    projectedRecurringUpTo(userId, asOfIso),
  ]);

  return list.map((acc) => {
    let balanceMinor = BigInt(acc.initialBalanceMinor);
    const accountSums = sumsAsAccount.filter((s) => s.accountId === acc.id);
    const destinationSums = sumsAsTransfer.filter((s) => s.accountId === acc.id);

    for (const s of accountSums) {
      balanceMinor += balanceDeltaFor(acc.type as AccountType, s.kind, true, BigInt(s.total ?? 0));
    }
    for (const s of destinationSums) {
      balanceMinor += balanceDeltaFor(acc.type as AccountType, s.kind, false, BigInt(s.total ?? 0));
    }
    for (const p of projected) {
      if (p.accountId === acc.id) {
        balanceMinor += balanceDeltaFor(acc.type as AccountType, p.kind, true, p.amountMinor);
      }
      if (p.transferAccountId === acc.id) {
        balanceMinor += balanceDeltaFor(acc.type as AccountType, p.kind, false, p.amountMinor);
      }
    }

    return {
      ...acc,
      balanceMinor,
      classification: classifyAccount(acc.type as AccountType),
    };
  });
});

export async function getAccountTransactions(userId: UserId, accountId: string) {
  return db.query.transactions.findMany({
    where: and(
      eq(transactions.userId, userId),
      or(eq(transactions.accountId, accountId), eq(transactions.transferAccountId, accountId)),
    ),
    with: { account: true, transferAccount: true, category: true },
    orderBy: (t, { desc }) => [desc(t.occurredAt), desc(t.createdAt)],
    limit: 200,
  });
}

export const computeAccountBalance = cache(async function computeAccountBalance(
  userId: UserId,
  accountId: string,
): Promise<bigint> {
  const account = await getAccountById(userId, accountId);
  if (!account) return 0n;

  const sumsAsAccount = await db
    .select({
      kind: transactions.kind,
      total: sum(transactions.amountMinor).mapWith(Number),
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.accountId, accountId)))
    .groupBy(transactions.kind);

  const sumsAsTransfer = await db
    .select({
      kind: transactions.kind,
      total: sum(transactions.amountMinor).mapWith(Number),
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.transferAccountId, accountId),
        or(eq(transactions.kind, 'transfer'), eq(transactions.kind, 'credit_card_payment')),
      ),
    )
    .groupBy(transactions.kind);

  let balance = BigInt(account.initialBalanceMinor);
  for (const s of sumsAsAccount) {
    balance += balanceDeltaFor(account.type as AccountType, s.kind, true, BigInt(s.total ?? 0));
  }
  for (const s of sumsAsTransfer) {
    balance += balanceDeltaFor(account.type as AccountType, s.kind, false, BigInt(s.total ?? 0));
  }
  return balance;
});
