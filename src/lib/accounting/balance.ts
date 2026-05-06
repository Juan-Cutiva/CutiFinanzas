import 'server-only';
import { and, eq, gt, isNotNull, lte, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { accounts, recurringRules, transactions } from '@/db/schema';
import type { UserId } from '@/types/ids';
import type { AccountKind } from './delta';
import { generateVirtualOccurrences, type RecurringRuleForVirtuals } from './virtuals';

/**
 * Saldo derivado de una cuenta en una fecha dada (inclusive). Solo cuenta movimientos
 * REALES (ya en la tabla `transactions`).
 *
 * Para cuentas asset: saldo = initialBalance + Σ deltas.
 * Para credit_card: saldo = Σ (cc_charge − cc_payment) (positivo = lo que debes).
 */
export async function getRealBalanceMinor(
  userId: UserId,
  accountId: string,
  asOfDate: string,
): Promise<bigint> {
  const account = await db.query.accounts.findFirst({
    where: and(eq(accounts.id, accountId), eq(accounts.userId, userId)),
  });
  if (!account) return 0n;

  const initial = BigInt(account.initialBalanceMinor as unknown as string | number | bigint);

  // Suma de impactos donde la cuenta es PRINCIPAL (accountId = X).
  // Mapeamos cada kind a +/-amount como en deltaFor().
  // NOTA: NO filtramos por isPaid. isPaid es solo una marca visual que el
  // usuario usa para confirmar manualmente; no debe afectar el balance ni los
  // totales (eso duplicaría/desbalancearía la contabilidad al alternar el check).
  const principal = await db
    .select({
      sum: sql<string | null>`COALESCE(SUM(
        CASE ${transactions.kind}
          WHEN 'expense'              THEN -${transactions.amountMinor}
          WHEN 'transfer'             THEN -${transactions.amountMinor}
          WHEN 'cc_payment'           THEN -${transactions.amountMinor}
          WHEN 'loan_payment'         THEN -${transactions.amountMinor}
          WHEN 'savings_contribution' THEN -${transactions.amountMinor}
          WHEN 'income'               THEN  ${transactions.amountMinor}
          WHEN 'refund'               THEN  ${transactions.amountMinor}
          WHEN 'cc_charge'            THEN  ${transactions.amountMinor}
          ELSE 0
        END
      ), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.accountId, accountId),
        lte(transactions.transactionDate, asOfDate),
      ),
    );
  const principalDelta = BigInt(principal[0]?.sum ?? 0);

  // Suma de impactos donde la cuenta es COUNTER (transfer destino, cc_payment destino).
  const counter = await db
    .select({
      sum: sql<string | null>`COALESCE(SUM(
        CASE ${transactions.kind}
          WHEN 'transfer'   THEN  ${transactions.amountMinor}
          WHEN 'cc_payment' THEN -${transactions.amountMinor}
          ELSE 0
        END
      ), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.counterAccountId, accountId),
        lte(transactions.transactionDate, asOfDate),
      ),
    );
  const counterDelta = BigInt(counter[0]?.sum ?? 0);

  return initial + principalDelta + counterDelta;
}

/**
 * Saldo proyectado: saldo real al día `today` + impacto de todas las ocurrencias virtuales
 * de reglas recurrentes activas hasta `asOfDate` (exclusivo de today).
 *
 * Si asOfDate ≤ today, no hay proyección — devuelve igual al saldo real.
 */
export async function getProjectedBalanceMinor(
  userId: UserId,
  accountId: string,
  asOfDate: string,
  today: string,
): Promise<{ realMinor: bigint; projectedMinor: bigint }> {
  const real = await getRealBalanceMinor(userId, accountId, today);
  if (asOfDate <= today) {
    if (asOfDate < today) {
      const past = await getRealBalanceMinor(userId, accountId, asOfDate);
      return { realMinor: past, projectedMinor: past };
    }
    return { realMinor: real, projectedMinor: real };
  }
  // Proyección al cierre de asOfDate.
  // Incluye:
  //   1. Todas las transacciones REALES con fecha ≤ asOfDate (incluso futuras
  //      ya registradas, como una nómina del día 23 ya materializada).
  //   2. Las VIRTUALES pendientes de materializar (cron aún no las creó).
  // Las virtuales arrancan desde rule.nextOccurrenceDate, así que son disjuntas
  // con las reales y no hay doble conteo.
  const realAtAsOf = await getRealBalanceMinor(userId, accountId, asOfDate);
  const rules = await db
    .select()
    .from(recurringRules)
    .where(and(eq(recurringRules.userId, userId), eq(recurringRules.isActive, true)));

  // Set de (ruleId, date) ya materializadas en (today, asOfDate] — para evitar
  // contar doble cuando una virtual ya fue materializada (por edit puntual o cron).
  const matRows = await db
    .select({ ruleId: transactions.recurringRuleId, date: transactions.transactionDate })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gt(transactions.transactionDate, today),
        lte(transactions.transactionDate, asOfDate),
        isNotNull(transactions.recurringRuleId),
      ),
    );
  const matSet = new Set<string>();
  for (const r of matRows) {
    if (r.ruleId) matSet.add(`${r.ruleId}:${r.date}`);
  }

  let delta = 0n;
  for (const r of rules) {
    const rule = ruleToVirtuals(r);
    const virtuals = generateVirtualOccurrences(rule, asOfDate);
    for (const v of virtuals) {
      if (matSet.has(`${r.id}:${v.transactionDate}`)) continue;
      delta += deltaForAccount(v, accountId);
    }
  }
  return { realMinor: real, projectedMinor: realAtAsOf + delta };
}

function ruleToVirtuals(r: typeof recurringRules.$inferSelect): RecurringRuleForVirtuals {
  return {
    id: r.id,
    kind: r.kind,
    amountMinor: BigInt(r.amountMinor as unknown as string | number | bigint),
    currency: r.currency,
    frequency: r.frequency as RecurringRuleForVirtuals['frequency'],
    dayOfMonth: r.dayOfMonth,
    dayOfWeek: r.dayOfWeek,
    startDate: r.startDate,
    endDate: r.endDate,
    nextOccurrenceDate: r.nextOccurrenceDate,
    accountId: r.accountId,
    counterAccountId: r.counterAccountId,
    categoryId: r.categoryId,
    debtId: r.debtId,
    savingsGoalId: r.savingsGoalId,
    isActive: r.isActive,
  };
}

function deltaForAccount(
  v: { kind: string; amountMinor: bigint; accountId: string; counterAccountId: string | null },
  accountId: string,
): bigint {
  if (v.accountId === accountId) {
    switch (v.kind) {
      case 'expense':
      case 'transfer':
      case 'cc_payment':
      case 'loan_payment':
      case 'savings_contribution':
        return -v.amountMinor;
      case 'income':
      case 'refund':
      case 'cc_charge':
        return v.amountMinor;
    }
  }
  if (v.counterAccountId === accountId) {
    if (v.kind === 'transfer') return v.amountMinor;
    if (v.kind === 'cc_payment') return -v.amountMinor;
  }
  return 0n;
}

export interface AccountWithBalance {
  id: string;
  name: string;
  type: AccountKind;
  currency: string;
  icon: string;
  color: string;
  institution: string | null;
  creditLimitMinor: bigint | null;
  initialBalanceMinor: bigint;
  realMinor: bigint;
  projectedMinor: bigint;
}

/**
 * Lista todas las cuentas (no archivadas) del usuario con saldo real y proyectado.
 */
export async function listAccountsWithBalances(
  userId: UserId,
  asOfDate: string,
  today: string,
): Promise<AccountWithBalance[]> {
  const rows = await db.query.accounts.findMany({
    where: and(eq(accounts.userId, userId), sql`${accounts.archivedAt} is null`),
    orderBy: (a, { asc }) => [asc(a.createdAt)],
  });

  const out: AccountWithBalance[] = [];
  for (const a of rows) {
    const { realMinor, projectedMinor } = await getProjectedBalanceMinor(
      userId,
      a.id,
      asOfDate,
      today,
    );
    out.push({
      id: a.id,
      name: a.name,
      type: a.type as AccountKind,
      currency: a.currency,
      icon: a.icon,
      color: a.color,
      institution: a.institution,
      creditLimitMinor: a.creditLimitMinor as bigint | null,
      initialBalanceMinor: BigInt(a.initialBalanceMinor as unknown as string | number | bigint),
      realMinor,
      projectedMinor,
    });
  }
  return out;
}
