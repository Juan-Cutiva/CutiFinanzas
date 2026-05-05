import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  throw new Error('Falta DATABASE_URL_UNPOOLED o DATABASE_URL en el entorno');
}

async function main() {
  if (!url) throw new Error('DATABASE_URL_UNPOOLED no encontrado');
  const sql = neon(url);
  process.stdout.write('[reset] Dropping schema public...\n');
  // biome-ignore lint/suspicious/noExplicitAny: neon dynamic SQL
  await (sql as any)`DROP SCHEMA IF EXISTS public CASCADE`;
  // biome-ignore lint/suspicious/noExplicitAny: neon dynamic SQL
  await (sql as any)`CREATE SCHEMA public`;
  // biome-ignore lint/suspicious/noExplicitAny: neon dynamic SQL
  await (sql as any)`GRANT ALL ON SCHEMA public TO public`;
  process.stdout.write('[reset] Schema public recreated. Next: run db:push.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
