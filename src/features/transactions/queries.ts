import 'server-only';
import dayjs from 'dayjs';
import { and, between, desc, eq, inArray, lte, or, sql, sum } from 'drizzle-orm';
import { cache } from 'react';
import { db } from '@/db/client';
import { accounts, recurringRules, transactions } from '@/db/schema';
import type { UserId } from '@/types/ids';

const EXPENSE_KINDS = [
  'expense_fixed',
  'expense_variable',
  'debt_payment',
  'savings_contribution',
  'credit_card_payment',
] as const;

const INCOME_KINDS = ['income', 'income_fixed', 'income_variable'] as const;

const NON_CASHFLOW_KINDS = new Set(['transfer']);

const PURCHASE_KINDS = new Set(['expense_fixed', 'expense_variable']);
const INCOME_KIND_SET = new Set(['income', 'income_fixed', 'income_variable', 'refund']);

const getLiabilityAccountIds = cache(async function getLiabilityAccountIds(
  userId: UserId,
): Promise<Set<string>> {
  const rows = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, userId),
        or(eq(accounts.type, 'credit_card'), eq(accounts.type, 'loan')),
      ),
    );
  return new Set(rows.map((r) => r.id));
});

/**
 * Determina si una transacción cuenta como flujo de caja real.
 * - expense_* en una cuenta de crédito/préstamo: NO (estás usando cupo del
 *   banco, no plata propia). El gasto real ocurre cuando pagas la tarjeta.
 * - income/refund en cuenta de crédito: NO (está abonando deuda, no es
 *   ingreso real).
 * - transfer: NO.
 * - resto: SÍ.
 */
function isCashflowRow(kind: string, accountId: string | null, liabilityIds: Set<string>): boolean {
  if (NON_CASHFLOW_KINDS.has(kind)) return false;
  if (!accountId) return true;
  const isLiability = liabilityIds.has(accountId);
  if (PURCHASE_KINDS.has(kind) && isLiability) return false;
  if (INCOME_KIND_SET.has(kind) && isLiability) return false;
  return true;
}

function monthRange(year: number, month: number): { from: string; to: string } {
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

interface VirtualOccurrence {
  ruleId: string;
  occurredAt: string;
  kind: string;
  amountMinor: bigint;
  currency: string;
  description: string;
  accountId: string;
  transferAccountId: string | null;
  categoryId: string | null;
  debtId: string | null;
  savingsGoalId: string | null;
  notes: string | null;
}

const virtualOccurrencesForRange = cache(async function virtualOccurrencesForRange(
  userId: UserId,
  fromIso: string,
  toIso: string,
): Promise<VirtualOccurrence[]> {
  const rules = await db.query.recurringRules.findMany({
    where: and(
      eq(recurringRules.userId, userId),
      eq(recurringRules.isActive, true),
      lte(recurringRules.startDate, toIso),
      or(sql`${recurringRules.endDate} is null`, sql`${recurringRules.endDate} >= ${fromIso}`),
    ),
  });

  if (rules.length === 0) return [];

  const realRows = await db
    .select({
      recurringRuleId: transactions.recurringRuleId,
      occurredAt: transactions.occurredAt,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        between(transactions.occurredAt, fromIso, toIso),
        sql`${transactions.recurringRuleId} is not null`,
      ),
    );

  const realKeys = new Set(
    realRows.filter((r) => r.recurringRuleId).map((r) => `${r.recurringRuleId}:${r.occurredAt}`),
  );

  const out: VirtualOccurrence[] = [];

  for (const rule of rules) {
    if (rule.frequency !== 'monthly') continue;
    const rangeFrom = dayjs(fromIso);
    const rangeTo = dayjs(toIso);
    let cursor = dayjs(rule.startDate);
    if (cursor.isAfter(rangeTo)) continue;

    if (cursor.isBefore(rangeFrom)) {
      cursor = rangeFrom.date(rule.dayOfMonth ?? cursor.date());
      if (cursor.isBefore(rangeFrom)) cursor = cursor.add(1, 'month');
    }

    let safety = 366;
    while (cursor.isSame(rangeTo) || cursor.isBefore(rangeTo)) {
      if (safety-- <= 0) break;
      const lastDay = cursor.endOf('month').date();
      const day = Math.min(rule.dayOfMonth ?? cursor.date(), lastDay);
      const dateStr = cursor.date(day).format('YYYY-MM-DD');

      if (
        dateStr >= fromIso &&
        dateStr <= toIso &&
        (!rule.endDate || dateStr <= rule.endDate) &&
        dateStr >= rule.startDate &&
        !realKeys.has(`${rule.id}:${dateStr}`)
      ) {
        out.push({
          ruleId: rule.id,
          occurredAt: dateStr,
          kind: rule.kind,
          amountMinor: rule.amountMinor as bigint,
          currency: rule.currency,
          description: rule.name,
          accountId: rule.accountId,
          transferAccountId: rule.transferAccountId ?? null,
          categoryId: rule.categoryId,
          debtId: rule.debtId ?? null,
          savingsGoalId: rule.savingsGoalId ?? null,
          notes: rule.notes,
        });
      }
      cursor = cursor.add(1, 'month');
    }
  }

  return out;
});

export async function listTransactionsByMonth(userId: UserId, year: number, month: number) {
  const { from, to } = monthRange(year, month);
  const [real, virtuals] = await Promise.all([
    db.query.transactions.findMany({
      where: and(eq(transactions.userId, userId), between(transactions.occurredAt, from, to)),
      with: { account: true, transferAccount: true, category: true },
      orderBy: [desc(transactions.occurredAt), desc(transactions.createdAt)],
    }),
    virtualOccurrencesForRange(userId, from, to),
  ]);

  if (virtuals.length === 0) return real;

  const accountIds = [
    ...new Set(
      virtuals.flatMap((v) => [v.accountId, v.transferAccountId]).filter(Boolean) as string[],
    ),
  ];
  const categoryIds = [...new Set(virtuals.map((v) => v.categoryId).filter(Boolean) as string[])];
  const [accountsList, categoriesList] = await Promise.all([
    accountIds.length > 0
      ? db.query.accounts.findMany({ where: (a, { inArray }) => inArray(a.id, accountIds) })
      : Promise.resolve([]),
    categoryIds.length > 0
      ? db.query.categories.findMany({ where: (c, { inArray }) => inArray(c.id, categoryIds) })
      : Promise.resolve([]),
  ]);
  const accountMap = new Map(accountsList.map((a) => [a.id, a]));
  const categoryMap = new Map(categoriesList.map((c) => [c.id, c]));

  type Real = (typeof real)[number];
  const virtualEntries: Real[] = virtuals.map((v) => ({
    id: `virtual:${v.ruleId}:${v.occurredAt}`,
    userId,
    accountId: v.accountId,
    transferAccountId: v.transferAccountId,
    categoryId: v.categoryId,
    debtId: v.debtId,
    savingsGoalId: v.savingsGoalId,
    kind: v.kind as Real['kind'],
    amountMinor: v.amountMinor,
    currency: v.currency,
    fxRate: null,
    fxAmountMinor: null,
    fxCurrency: null,
    occurredAt: v.occurredAt,
    description: v.description,
    notes: v.notes,
    isPaid: false,
    isRecurring: true,
    recurringRuleId: v.ruleId,
    quincena: Number.parseInt(v.occurredAt.slice(8, 10), 10) <= 15 ? 1 : 2,
    receiptUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    account: accountMap.get(v.accountId) ?? null,
    transferAccount: v.transferAccountId ? (accountMap.get(v.transferAccountId) ?? null) : null,
    category: v.categoryId ? (categoryMap.get(v.categoryId) ?? null) : null,
  })) as unknown as Real[];

  return [...real, ...virtualEntries].sort((a, b) =>
    a.occurredAt < b.occurredAt ? 1 : a.occurredAt > b.occurredAt ? -1 : 0,
  );
}

export async function listIncomeByMonth(userId: UserId, year: number, month: number) {
  const { from, to } = monthRange(year, month);
  const [real, virtuals] = await Promise.all([
    db.query.transactions.findMany({
      where: and(
        eq(transactions.userId, userId),
        between(transactions.occurredAt, from, to),
        inArray(transactions.kind, [...INCOME_KINDS]),
      ),
      with: { account: true, transferAccount: true, category: true },
      orderBy: [desc(transactions.occurredAt), desc(transactions.createdAt)],
    }),
    virtualOccurrencesForRange(userId, from, to),
  ]);

  const incomeVirtuals = virtuals.filter((v) =>
    (INCOME_KINDS as readonly string[]).includes(v.kind),
  );
  if (incomeVirtuals.length === 0) return real;

  const accountIds = [...new Set(incomeVirtuals.map((v) => v.accountId))];
  const categoryIds = [
    ...new Set(incomeVirtuals.map((v) => v.categoryId).filter(Boolean) as string[]),
  ];
  const [accountsList, categoriesList] = await Promise.all([
    accountIds.length > 0
      ? db.query.accounts.findMany({ where: (a, { inArray }) => inArray(a.id, accountIds) })
      : Promise.resolve([]),
    categoryIds.length > 0
      ? db.query.categories.findMany({ where: (c, { inArray }) => inArray(c.id, categoryIds) })
      : Promise.resolve([]),
  ]);
  const accountMap = new Map(accountsList.map((a) => [a.id, a]));
  const categoryMap = new Map(categoriesList.map((c) => [c.id, c]));

  type Real = (typeof real)[number];
  const virtualEntries: Real[] = incomeVirtuals.map((v) => ({
    id: `virtual:${v.ruleId}:${v.occurredAt}`,
    userId,
    accountId: v.accountId,
    transferAccountId: null,
    categoryId: v.categoryId,
    debtId: null,
    savingsGoalId: null,
    kind: v.kind as Real['kind'],
    amountMinor: v.amountMinor,
    currency: v.currency,
    fxRate: null,
    fxAmountMinor: null,
    fxCurrency: null,
    occurredAt: v.occurredAt,
    description: v.description,
    notes: v.notes,
    isPaid: false,
    isRecurring: true,
    recurringRuleId: v.ruleId,
    quincena: Number.parseInt(v.occurredAt.slice(8, 10), 10) <= 15 ? 1 : 2,
    receiptUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    account: accountMap.get(v.accountId) ?? null,
    transferAccount: null,
    category: v.categoryId ? (categoryMap.get(v.categoryId) ?? null) : null,
  })) as unknown as Real[];

  return [...real, ...virtualEntries].sort((a, b) =>
    a.occurredAt < b.occurredAt ? 1 : a.occurredAt > b.occurredAt ? -1 : 0,
  );
}

const PAGE_EXPENSE_KINDS = [
  'expense_fixed',
  'expense_variable',
  'credit_card_payment',
  'debt_payment',
] as const;

export async function listExpenseByMonth(userId: UserId, year: number, month: number) {
  const { from, to } = monthRange(year, month);
  const [real, virtuals] = await Promise.all([
    db.query.transactions.findMany({
      where: and(
        eq(transactions.userId, userId),
        between(transactions.occurredAt, from, to),
        inArray(transactions.kind, [...PAGE_EXPENSE_KINDS]),
      ),
      with: { account: true, transferAccount: true, category: true },
      orderBy: [desc(transactions.occurredAt), desc(transactions.createdAt)],
    }),
    virtualOccurrencesForRange(userId, from, to),
  ]);

  const expenseVirtuals = virtuals.filter((v) =>
    (PAGE_EXPENSE_KINDS as readonly string[]).includes(v.kind),
  );
  if (expenseVirtuals.length === 0) return real;

  const accountIds = [
    ...new Set(
      expenseVirtuals
        .flatMap((v) => [v.accountId, v.transferAccountId])
        .filter(Boolean) as string[],
    ),
  ];
  const categoryIds = [
    ...new Set(expenseVirtuals.map((v) => v.categoryId).filter(Boolean) as string[]),
  ];
  const [accountsList, categoriesList] = await Promise.all([
    accountIds.length > 0
      ? db.query.accounts.findMany({ where: (a, { inArray }) => inArray(a.id, accountIds) })
      : Promise.resolve([]),
    categoryIds.length > 0
      ? db.query.categories.findMany({ where: (c, { inArray }) => inArray(c.id, categoryIds) })
      : Promise.resolve([]),
  ]);
  const accountMap = new Map(accountsList.map((a) => [a.id, a]));
  const categoryMap = new Map(categoriesList.map((c) => [c.id, c]));

  type Real = (typeof real)[number];
  const virtualEntries: Real[] = expenseVirtuals.map((v) => ({
    id: `virtual:${v.ruleId}:${v.occurredAt}`,
    userId,
    accountId: v.accountId,
    transferAccountId: v.transferAccountId,
    categoryId: v.categoryId,
    debtId: v.debtId,
    savingsGoalId: v.savingsGoalId,
    kind: v.kind as Real['kind'],
    amountMinor: v.amountMinor,
    currency: v.currency,
    fxRate: null,
    fxAmountMinor: null,
    fxCurrency: null,
    occurredAt: v.occurredAt,
    description: v.description,
    notes: v.notes,
    isPaid: false,
    isRecurring: true,
    recurringRuleId: v.ruleId,
    quincena: Number.parseInt(v.occurredAt.slice(8, 10), 10) <= 15 ? 1 : 2,
    receiptUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    account: accountMap.get(v.accountId) ?? null,
    transferAccount: v.transferAccountId ? (accountMap.get(v.transferAccountId) ?? null) : null,
    category: v.categoryId ? (categoryMap.get(v.categoryId) ?? null) : null,
  })) as unknown as Real[];

  return [...real, ...virtualEntries].sort((a, b) =>
    a.occurredAt < b.occurredAt ? 1 : a.occurredAt > b.occurredAt ? -1 : 0,
  );
}

export async function totalsByMonth(userId: UserId, year: number, month: number) {
  const { from, to } = monthRange(year, month);
  const [rows, virtuals, liabilityIds] = await Promise.all([
    db
      .select({
        kind: transactions.kind,
        accountId: transactions.accountId,
        total: sum(transactions.amountMinor).mapWith(Number),
      })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), between(transactions.occurredAt, from, to)))
      .groupBy(transactions.kind, transactions.accountId),
    virtualOccurrencesForRange(userId, from, to),
    getLiabilityAccountIds(userId),
  ]);

  const map: Record<string, number> = {};
  for (const r of rows) {
    if (!isCashflowRow(r.kind, r.accountId, liabilityIds)) continue;
    map[r.kind] = (map[r.kind] ?? 0) + (r.total ?? 0);
  }
  for (const v of virtuals) {
    if (!isCashflowRow(v.kind, v.accountId, liabilityIds)) continue;
    map[v.kind] = (map[v.kind] ?? 0) + Number(v.amountMinor);
  }

  const incomeFixed = (map.income_fixed ?? 0) + (map.income ?? 0);
  const incomeVariable = (map.income_variable ?? 0) + (map.refund ?? 0);
  return {
    incomeMinor: incomeFixed + incomeVariable,
    incomeFixedMinor: incomeFixed,
    incomeVariableMinor: incomeVariable,
    expenseFixedMinor: map.expense_fixed ?? 0,
    expenseVariableMinor: map.expense_variable ?? 0,
    creditCardPaymentMinor: map.credit_card_payment ?? 0,
    debtPaymentMinor: map.debt_payment ?? 0,
    savingsContributionMinor: map.savings_contribution ?? 0,
  };
}

export async function totalsForRange(userId: UserId, fromDate: string, toDate: string) {
  const [rows, virtuals, liabilityIds] = await Promise.all([
    db
      .select({
        kind: transactions.kind,
        accountId: transactions.accountId,
        total: sum(transactions.amountMinor).mapWith(Number),
      })
      .from(transactions)
      .where(
        and(eq(transactions.userId, userId), between(transactions.occurredAt, fromDate, toDate)),
      )
      .groupBy(transactions.kind, transactions.accountId),
    virtualOccurrencesForRange(userId, fromDate, toDate),
    getLiabilityAccountIds(userId),
  ]);

  const map: Record<string, number> = {};
  for (const r of rows) {
    if (!isCashflowRow(r.kind, r.accountId, liabilityIds)) continue;
    map[r.kind] = (map[r.kind] ?? 0) + (r.total ?? 0);
  }
  for (const v of virtuals) {
    if (!isCashflowRow(v.kind, v.accountId, liabilityIds)) continue;
    map[v.kind] = (map[v.kind] ?? 0) + Number(v.amountMinor);
  }

  const incomeFixed = (map.income_fixed ?? 0) + (map.income ?? 0);
  const incomeVariable = (map.income_variable ?? 0) + (map.refund ?? 0);
  const expense =
    (map.expense_fixed ?? 0) +
    (map.expense_variable ?? 0) +
    (map.debt_payment ?? 0) +
    (map.savings_contribution ?? 0) +
    (map.credit_card_payment ?? 0);
  return {
    incomeMinor: incomeFixed + incomeVariable,
    expenseMinor: expense,
    balanceMinor: incomeFixed + incomeVariable - expense,
  };
}

export async function totalsByMonthForYear(userId: UserId, year: number) {
  const [rows, liabilityIds] = await Promise.all([
    db
      .select({
        month: sql<string>`to_char(${transactions.occurredAt}::date, 'MM')`,
        kind: transactions.kind,
        accountId: transactions.accountId,
        total: sum(transactions.amountMinor).mapWith(Number),
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          sql`extract(year from ${transactions.occurredAt}::date) = ${year}`,
        ),
      )
      .groupBy(
        sql`to_char(${transactions.occurredAt}::date, 'MM')`,
        transactions.kind,
        transactions.accountId,
      ),
    getLiabilityAccountIds(userId),
  ]);

  type Bucket = { incomeMinor: number; expenseMinor: number };
  const buckets: Record<number, Bucket> = {};
  for (let m = 1; m <= 12; m++) buckets[m] = { incomeMinor: 0, expenseMinor: 0 };

  function classify(
    bucket: Bucket | undefined,
    kind: string,
    accountId: string | null,
    amount: number,
  ) {
    if (!bucket) return;
    if (!isCashflowRow(kind, accountId, liabilityIds)) return;
    if (INCOME_KIND_SET.has(kind)) {
      bucket.incomeMinor += amount;
    } else {
      bucket.expenseMinor += amount;
    }
  }

  for (const r of rows) {
    const m = Number.parseInt(r.month, 10);
    classify(buckets[m], r.kind, r.accountId, r.total ?? 0);
  }

  const yearFrom = `${year}-01-01`;
  const yearTo = `${year}-12-31`;
  const virtuals = await virtualOccurrencesForRange(userId, yearFrom, yearTo);
  for (const v of virtuals) {
    const m = Number.parseInt(v.occurredAt.slice(5, 7), 10);
    classify(buckets[m], v.kind, v.accountId, Number(v.amountMinor));
  }

  return Array.from({ length: 12 }, (_, i) => {
    const b = buckets[i + 1] ?? { incomeMinor: 0, expenseMinor: 0 };
    return {
      month: i + 1,
      incomeMinor: b.incomeMinor,
      expenseMinor: b.expenseMinor,
      balanceMinor: b.incomeMinor - b.expenseMinor,
    };
  });
}

export async function dailyTotalsForMonth(userId: UserId, year: number, month: number) {
  const { from, to } = monthRange(year, month);
  const [rows, virtuals, liabilityIds] = await Promise.all([
    db
      .select({
        day: sql<string>`to_char(${transactions.occurredAt}::date, 'YYYY-MM-DD')`,
        kind: transactions.kind,
        accountId: transactions.accountId,
        total: sum(transactions.amountMinor).mapWith(Number),
      })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), between(transactions.occurredAt, from, to)))
      .groupBy(
        sql`to_char(${transactions.occurredAt}::date, 'YYYY-MM-DD')`,
        transactions.kind,
        transactions.accountId,
      ),
    virtualOccurrencesForRange(userId, from, to),
    getLiabilityAccountIds(userId),
  ]);

  const map: Record<string, number> = {};
  for (const r of rows) {
    if (!isCashflowRow(r.kind, r.accountId, liabilityIds)) continue;
    if (INCOME_KIND_SET.has(r.kind)) continue;
    map[r.day] = (map[r.day] ?? 0) + (r.total ?? 0);
  }
  for (const v of virtuals) {
    if (!isCashflowRow(v.kind, v.accountId, liabilityIds)) continue;
    if (INCOME_KIND_SET.has(v.kind)) continue;
    map[v.occurredAt] = (map[v.occurredAt] ?? 0) + Number(v.amountMinor);
  }
  return map;
}

export async function totalsByCategoryByMonth(userId: UserId, year: number, month: number) {
  const { from, to } = monthRange(year, month);
  const [rows, virtuals, liabilityIds] = await Promise.all([
    db
      .select({
        categoryId: transactions.categoryId,
        kind: transactions.kind,
        accountId: transactions.accountId,
        total: sum(transactions.amountMinor).mapWith(Number),
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          between(transactions.occurredAt, from, to),
          inArray(transactions.kind, [...EXPENSE_KINDS]),
        ),
      )
      .groupBy(transactions.categoryId, transactions.kind, transactions.accountId),
    virtualOccurrencesForRange(userId, from, to),
    getLiabilityAccountIds(userId),
  ]);

  const expenseKindsSet = new Set<string>(EXPENSE_KINDS);
  const map = new Map<string | null, number>();
  for (const r of rows) {
    if (!isCashflowRow(r.kind, r.accountId, liabilityIds)) continue;
    map.set(r.categoryId, (map.get(r.categoryId) ?? 0) + (r.total ?? 0));
  }
  for (const v of virtuals) {
    if (!expenseKindsSet.has(v.kind)) continue;
    if (!isCashflowRow(v.kind, v.accountId, liabilityIds)) continue;
    map.set(v.categoryId, (map.get(v.categoryId) ?? 0) + Number(v.amountMinor));
  }
  return Array.from(map.entries()).map(([categoryId, total]) => ({ categoryId, total }));
}
