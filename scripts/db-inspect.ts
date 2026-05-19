import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '../src/db/schema';

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) throw new Error('Falta DATABASE_URL');

const sql = neon(url);
const db = drizzle(sql, { schema });

async function main() {
  const out = (s: string) => process.stdout.write(`${s}\n`);

  // Usuarios
  const users = await db.select().from(schema.users);
  out('=== USERS ===');
  for (const u of users) {
    out(
      `${u.id} | ${u.email} | TZ=${u.timezone} | primaryAccountId=${u.primaryAccountId} | dashboardIds=${JSON.stringify(u.dashboardAccountIds)}`,
    );
  }

  if (users.length === 0) {
    out('No users.');
    return;
  }
  const userId = users[0]!.id;

  // Cuentas
  out('\n=== ACCOUNTS ===');
  const accounts = await db
    .select()
    .from(schema.accounts)
    .where(eq(schema.accounts.userId, userId));
  for (const a of accounts) {
    out(
      `${a.id.slice(0, 8)} | ${a.name} | type=${a.type} | initial=${a.initialBalanceMinor} | creditLimit=${a.creditLimitMinor} | archived=${a.archivedAt ? 'Y' : 'N'}`,
    );
  }

  const accountById = new Map(accounts.map((a) => [a.id, a]));

  // Transacciones
  out('\n=== TRANSACTIONS ===');
  const txs = await db
    .select()
    .from(schema.transactions)
    .where(eq(schema.transactions.userId, userId));
  txs.sort((a, b) => a.transactionDate.localeCompare(b.transactionDate));
  for (const t of txs) {
    const acc = t.accountId ? accountById.get(t.accountId) : null;
    const counter = t.counterAccountId ? accountById.get(t.counterAccountId) : null;
    out(
      `${t.transactionDate} | ${t.kind.padEnd(20)} | ${String(t.amountMinor).padStart(12)} | ${acc?.name ?? '?'} → ${counter?.name ?? '—'} | ${t.description ?? ''}${t.recurringRuleId ? ` [rule=${t.recurringRuleId.slice(0, 8)}]` : ''}`,
    );
  }

  // Reglas recurrentes
  out('\n=== RECURRING RULES ===');
  const rules = await db
    .select()
    .from(schema.recurringRules)
    .where(eq(schema.recurringRules.userId, userId));
  for (const r of rules) {
    const acc = r.accountId ? accountById.get(r.accountId) : null;
    out(
      `${r.id.slice(0, 8)} | ${r.kind.padEnd(20)} | ${String(r.amountMinor).padStart(12)} | acc=${acc?.name ?? '?'} | freq=${r.frequency} | start=${r.startDate} end=${r.endDate ?? '∞'} next=${r.nextOccurrenceDate} | active=${r.isActive ? 'Y' : 'N'} | name=${r.name}`,
    );
  }

  // Cálculo de saldo NÓMINA hoy
  out('\n=== NOMINA BALANCE BREAKDOWN ===');
  const nomina = accounts.find((a) => a.name.toUpperCase().includes('NOMINA'));
  if (nomina) {
    const today = new Date().toISOString().slice(0, 10);
    out(`Today: ${today}`);
    out(`Initial: ${nomina.initialBalanceMinor}`);
    let balance = BigInt(nomina.initialBalanceMinor);
    for (const t of txs) {
      if (t.transactionDate > today) continue;
      let delta = 0n;
      const sign = (k: string, isOrigin: boolean): bigint => {
        const amt = BigInt(t.amountMinor);
        if (isOrigin) {
          if (
            ['expense', 'transfer', 'cc_payment', 'loan_payment', 'savings_contribution'].includes(
              k,
            )
          )
            return -amt;
          if (['income', 'refund', 'cc_charge'].includes(k)) return amt;
        } else {
          if (k === 'transfer') return amt;
          if (k === 'cc_payment') return -amt;
        }
        return 0n;
      };
      if (t.accountId === nomina.id) delta = sign(t.kind, true);
      else if (t.counterAccountId === nomina.id) delta = sign(t.kind, false);
      if (delta !== 0n) {
        balance += delta;
        out(
          `  ${t.transactionDate} | ${t.kind.padEnd(20)} | ${delta >= 0 ? '+' : ''}${delta} → balance=${balance} | ${t.description ?? ''}`,
        );
      }
    }
    out(`FINAL NOMINA today: ${balance}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    process.stderr.write(`${err}\n`);
    process.exit(1);
  });
