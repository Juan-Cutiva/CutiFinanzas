/**
 * Borra TODOS los datos de la DB Neon (incluido users).
 * El user se recrea solo en el próximo login vía getOrCreateUser.
 *
 * Uso: pnpm exec dotenv -e .env.local -- pnpm tsx scripts/nuke-db.ts
 */
import { neon } from '@neondatabase/serverless';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Falta DATABASE_URL');
  const sql = neon(url);

  const tables = [
    'transactions',
    'recurring_rules',
    'budgets',
    'debts',
    'savings_goals',
    'push_subscriptions',
    'categories',
    'accounts',
    'users',
  ];

  await sql.query(`TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`);

  for (const t of tables) {
    const rows = await sql.query(`SELECT COUNT(*)::int AS n FROM ${t}`);
    const n = Array.isArray(rows) && rows[0] ? (rows[0] as { n: number }).n : -1;
    console.info(`${t}: ${n} registros restantes`);
  }
}

main()
  .then(() => {
    console.info('\nDB limpia.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
