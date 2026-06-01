import 'server-only';
import { and, eq, inArray, isNotNull, lte, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { accounts, recurringRules, transactions } from '@/db/schema';
import { NotFoundError } from '@/lib/errors';
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
  // Antes retornaba 0n silenciosamente — enmascaraba bugs (cuenta borrada, id mal
  // pasado). Ahora propaga el error y el caller decide cómo manejarlo.
  if (!account) throw new NotFoundError('Cuenta');

  const initial = BigInt(account.initialBalanceMinor as unknown as string | number | bigint);
  const deltas = await sumAccountDeltasAsOf(userId, [accountId], asOfDate);
  return initial + (deltas.get(accountId) ?? 0n);
}

/**
 * Suma los deltas (impacto en saldo) de un conjunto de cuentas hasta `asOfDate`.
 * Devuelve un Map<accountId, deltaMinor>.
 *
 * NO incluye `initialBalanceMinor` — es solo el efecto acumulado de transacciones.
 *
 * Implementación: 2 queries en paralelo (una donde la cuenta es ORIGEN, otra donde es
 * DESTINO). Una transferencia entre dos cuentas del mismo usuario aparece en AMBAS
 * y aporta a cada lado correctamente (origen pierde, destino gana).
 *
 * NOTA: NO filtramos por isPaid. isPaid es solo una marca visual; afecta UI, no balance.
 */
async function sumAccountDeltasAsOf(
  userId: UserId,
  accountIds: string[],
  asOfDate: string,
): Promise<Map<string, bigint>> {
  if (accountIds.length === 0) return new Map();

  const [principalRows, counterRows] = await Promise.all([
    db
      .select({
        accountId: transactions.accountId,
        delta: sql<string | null>`COALESCE(SUM(
          CASE ${transactions.kind}
            WHEN 'expense'              THEN -${transactions.amountMinor}
            WHEN 'transfer'             THEN -${transactions.amountMinor}
            WHEN 'cc_payment'           THEN -${transactions.amountMinor}
            WHEN 'loan_payment'         THEN -${transactions.amountMinor}
            WHEN 'savings_contribution' THEN -${transactions.amountMinor}
            WHEN 'income'               THEN  ${transactions.amountMinor}
            WHEN 'refund'               THEN  ${transactions.amountMinor}
            WHEN 'cc_charge'            THEN  ${transactions.amountMinor}
            WHEN 'loan_charge'          THEN  ${transactions.amountMinor}
            ELSE 0
          END
        ), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          inArray(transactions.accountId, accountIds),
          lte(transactions.transactionDate, asOfDate),
        ),
      )
      .groupBy(transactions.accountId),
    db
      .select({
        accountId: transactions.counterAccountId,
        delta: sql<string | null>`COALESCE(SUM(
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
          inArray(transactions.counterAccountId, accountIds),
          lte(transactions.transactionDate, asOfDate),
        ),
      )
      .groupBy(transactions.counterAccountId),
  ]);

  const out = new Map<string, bigint>();
  for (const r of principalRows) {
    if (r.accountId) out.set(r.accountId, BigInt(r.delta ?? 0));
  }
  for (const r of counterRows) {
    if (!r.accountId) continue;
    const prev = out.get(r.accountId) ?? 0n;
    out.set(r.accountId, prev + BigInt(r.delta ?? 0));
  }
  return out;
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
  const account = await db.query.accounts.findFirst({
    where: and(eq(accounts.id, accountId), eq(accounts.userId, userId)),
  });
  if (!account) throw new NotFoundError('Cuenta');
  const initial = BigInt(account.initialBalanceMinor as unknown as string | number | bigint);

  if (asOfDate <= today) {
    if (asOfDate < today) {
      const deltas = await sumAccountDeltasAsOf(userId, [accountId], asOfDate);
      const past = initial + (deltas.get(accountId) ?? 0n);
      return { realMinor: past, projectedMinor: past };
    }
    const deltas = await sumAccountDeltasAsOf(userId, [accountId], today);
    const real = initial + (deltas.get(accountId) ?? 0n);
    return { realMinor: real, projectedMinor: real };
  }

  // Proyección al cierre de asOfDate. Lanzamos las queries independientes en paralelo
  // (saldo today, saldo asOfDate, reglas activas, claves materializadas).
  const [todayDeltas, asOfDeltas, rules, matSet] = await Promise.all([
    sumAccountDeltasAsOf(userId, [accountId], today),
    sumAccountDeltasAsOf(userId, [accountId], asOfDate),
    db
      .select()
      .from(recurringRules)
      .where(and(eq(recurringRules.userId, userId), eq(recurringRules.isActive, true))),
    materializedKeysUpTo(userId, asOfDate),
  ]);

  const real = initial + (todayDeltas.get(accountId) ?? 0n);
  const realAtAsOf = initial + (asOfDeltas.get(accountId) ?? 0n);

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

/**
 * Set de (ruleId, date) ya materializadas con date ≤ asOfDate — para evitar
 * contar doble cuando una virtual ya fue materializada (por edit puntual o cron).
 *
 * NO se acota por una fecha inferior: `generateVirtualOccurrences` parte de
 * `rule.nextOccurrenceDate`, que puede quedar en el PASADO si el cron crasheó
 * después del insert pero antes de actualizar la regla. Sin esto, esa ocurrencia
 * pasada se contaría doble (como real + como virtual) hasta que el cron repare
 * el estado en la siguiente corrida.
 */
async function materializedKeysUpTo(userId: UserId, asOfDate: string): Promise<Set<string>> {
  const matRows = await db
    .select({ ruleId: transactions.recurringRuleId, date: transactions.transactionDate })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        lte(transactions.transactionDate, asOfDate),
        isNotNull(transactions.recurringRuleId),
      ),
    );
  const set = new Set<string>();
  for (const r of matRows) {
    if (r.ruleId) set.add(`${r.ruleId}:${r.date}`);
  }
  return set;
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
  v: {
    kind: string;
    amountMinor: bigint;
    accountId: string | null;
    counterAccountId: string | null;
  },
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
      case 'loan_charge':
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
 *
 * Implementación batch: en vez de N+1 (una llamada por cuenta), hace
 * 1 query para listar cuentas + hasta 4 queries agregadas en paralelo
 * (deltas today, deltas asOfDate, reglas activas, claves materializadas).
 * Total: 1 + 4 queries paralelas — independiente del número de cuentas.
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
  if (rows.length === 0) return [];

  const accountIds = rows.map((a) => a.id);
  const isFuture = asOfDate > today;
  const isPast = asOfDate < today;

  // Lanzamos las queries necesarias en paralelo. Para mes pasado solo necesitamos
  // los deltas a asOfDate (real == projected == saldo histórico). Para mes futuro
  // necesitamos ambos cortes + reglas + claves materializadas. Para hoy solo today.
  const [todayDeltas, asOfDeltas, rules, matSet] = await Promise.all([
    sumAccountDeltasAsOf(userId, accountIds, today),
    isFuture || isPast
      ? sumAccountDeltasAsOf(userId, accountIds, asOfDate)
      : Promise.resolve(new Map<string, bigint>()),
    isFuture
      ? db
          .select()
          .from(recurringRules)
          .where(and(eq(recurringRules.userId, userId), eq(recurringRules.isActive, true)))
      : Promise.resolve([] as (typeof recurringRules.$inferSelect)[]),
    isFuture ? materializedKeysUpTo(userId, asOfDate) : Promise.resolve(new Set<string>()),
  ]);

  // Pre-genera ocurrencias virtuales por regla (compartidas entre todas las cuentas).
  const virtsByRule: Array<{
    ruleId: string;
    occurrences: ReturnType<typeof generateVirtualOccurrences>;
  }> = [];
  if (isFuture) {
    for (const r of rules) {
      const ruleVirt = ruleToVirtuals(r);
      virtsByRule.push({
        ruleId: r.id,
        occurrences: generateVirtualOccurrences(ruleVirt, asOfDate),
      });
    }
  }

  return rows.map((a) => {
    const initial = BigInt(a.initialBalanceMinor as unknown as string | number | bigint);
    const realMinor = initial + (todayDeltas.get(a.id) ?? 0n);

    if (isPast) {
      const past = initial + (asOfDeltas.get(a.id) ?? 0n);
      // Para meses pasados real == projected == saldo histórico (semántica preservada
      // del comportamiento anterior: "saldo del día visto").
      return {
        id: a.id,
        name: a.name,
        type: a.type as AccountKind,
        currency: a.currency,
        icon: a.icon,
        color: a.color,
        institution: a.institution,
        creditLimitMinor: a.creditLimitMinor as bigint | null,
        initialBalanceMinor: initial,
        realMinor: past,
        projectedMinor: past,
      };
    }

    let projectedMinor: bigint;
    if (isFuture) {
      const realAtAsOf = initial + (asOfDeltas.get(a.id) ?? 0n);
      let delta = 0n;
      for (const { ruleId, occurrences } of virtsByRule) {
        for (const v of occurrences) {
          if (matSet.has(`${ruleId}:${v.transactionDate}`)) continue;
          delta += deltaForAccount(v, a.id);
        }
      }
      projectedMinor = realAtAsOf + delta;
    } else {
      projectedMinor = realMinor;
    }

    return {
      id: a.id,
      name: a.name,
      type: a.type as AccountKind,
      currency: a.currency,
      icon: a.icon,
      color: a.color,
      institution: a.institution,
      creditLimitMinor: a.creditLimitMinor as bigint | null,
      initialBalanceMinor: initial,
      realMinor,
      projectedMinor,
    };
  });
}
