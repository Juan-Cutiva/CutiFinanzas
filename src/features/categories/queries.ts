import 'server-only';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { categories } from '@/db/schema';
import type { UserId } from '@/types/ids';

export async function listCategoriesByUser(userId: UserId) {
  return db
    .select()
    .from(categories)
    .where(and(eq(categories.userId, userId), isNull(categories.archivedAt)))
    .orderBy(asc(categories.sortOrder), asc(categories.name));
}

export async function getCategoryById(userId: UserId, id: string) {
  return db.query.categories.findFirst({
    where: and(eq(categories.userId, userId), eq(categories.id, id)),
  });
}

export async function countActiveCategories(userId: UserId): Promise<number> {
  const rows = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.userId, userId), isNull(categories.archivedAt)));
  return rows.length;
}
