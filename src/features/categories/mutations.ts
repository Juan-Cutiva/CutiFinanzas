import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { categories } from '@/db/schema';
import { NotFoundError } from '@/lib/errors';
import type { UserId } from '@/types/ids';
import { type CategoryInput, DEFAULT_CATEGORIES, type UpdateCategoryInput } from './schema';

export async function createCategory(userId: UserId, input: CategoryInput) {
  const [row] = await db
    .insert(categories)
    .values({ ...input, userId, parentId: input.parentId ?? null })
    .returning();
  if (!row) throw new Error('No se pudo crear la categoría');
  return row;
}

export async function updateCategory(userId: UserId, input: UpdateCategoryInput) {
  const { id, ...patch } = input;
  const [row] = await db
    .update(categories)
    .set({ ...patch, updatedAt: sql`now()` })
    .where(and(eq(categories.userId, userId), eq(categories.id, id)))
    .returning();
  if (!row) throw new NotFoundError('Categoría');
  return row;
}

export async function archiveCategory(userId: UserId, id: string) {
  const [row] = await db
    .update(categories)
    .set({ archivedAt: sql`now()`, updatedAt: sql`now()` })
    .where(and(eq(categories.userId, userId), eq(categories.id, id)))
    .returning();
  if (!row) throw new NotFoundError('Categoría');
  return row;
}

export async function seedDefaultCategoriesIfEmpty(userId: UserId) {
  const existing = await db.query.categories.findFirst({
    where: eq(categories.userId, userId),
  });
  if (existing) return [];

  return db
    .insert(categories)
    .values(DEFAULT_CATEGORIES.map((c) => ({ ...c, userId })))
    .returning();
}
