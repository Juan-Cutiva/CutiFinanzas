import { eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { getOrCreateUser } from '@/db/queries/users';
import {
  accounts,
  budgets,
  categories,
  debts,
  recurringRules,
  savingsGoals,
  transactions,
} from '@/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function serialize(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = serialize(v);
    return out;
  }
  return value;
}

export async function GET(_req: NextRequest) {
  const user = await getOrCreateUser();
  const userId = user.id;

  const [accs, cats, txs, bgs, dbs, sgs, rrs] = await Promise.all([
    db.select().from(accounts).where(eq(accounts.userId, userId)),
    db.select().from(categories).where(eq(categories.userId, userId)),
    db.select().from(transactions).where(eq(transactions.userId, userId)),
    db.select().from(budgets).where(eq(budgets.userId, userId)),
    db.select().from(debts).where(eq(debts.userId, userId)),
    db.select().from(savingsGoals).where(eq(savingsGoals.userId, userId)),
    db.select().from(recurringRules).where(eq(recurringRules.userId, userId)),
  ]);

  const payload = {
    schema: 'cutifinanzas/v1',
    exportedAt: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      defaultCurrency: user.defaultCurrency,
      locale: user.locale,
      timezone: user.timezone,
      payFrequency: user.payFrequency,
    },
    accounts: serialize(accs),
    categories: serialize(cats),
    transactions: serialize(txs),
    budgets: serialize(bgs),
    debts: serialize(dbs),
    savingsGoals: serialize(sgs),
    recurringRules: serialize(rrs),
  };

  const json = JSON.stringify(payload, null, 2);
  const filename = `cutifinanzas-export-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(json, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
