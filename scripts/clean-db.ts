/**
 * Borra todos los datos excepto users de la DB Neon.
 * Uso: pnpm exec dotenv -e .env.local -- pnpm tsx scripts/clean-db.ts
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
  ];

  for (const t of tables) {
    const result = await sql.query(`DELETE FROM ${t} RETURNING id`);
    console.info(`✓ ${t}: ${result.length} registros eliminados`);
  }

  const userCount = await sql.query('SELECT COUNT(*)::int AS n FROM users');
  const n = Array.isArray(userCount) && userCount[0] ? (userCount[0] as { n: number }).n : 0;
  console.info(`\nUsers conservados: ${n}`);
}

main()
  .then(() => {
    console.info('\nLimpieza completa.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
