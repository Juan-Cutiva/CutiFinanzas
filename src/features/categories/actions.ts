'use server';

import { z } from 'zod';
import { revalidateAfterCategory } from '@/lib/cache-tags';
import { authedAction } from '@/lib/safe-action';
import {
  archiveCategory,
  createCategory,
  seedDefaultCategoriesIfEmpty,
  updateCategory,
} from './mutations';
import { categoryInputSchema, deleteCategorySchema, updateCategorySchema } from './schema';

export const createCategoryAction = authedAction
  .metadata({ actionName: 'createCategory' })
  .inputSchema(categoryInputSchema)
  .action(async ({ parsedInput, ctx }) => {
    const row = await createCategory(ctx.userId, parsedInput);
    revalidateAfterCategory(ctx.userId);
    return row;
  });

export const updateCategoryAction = authedAction
  .metadata({ actionName: 'updateCategory' })
  .inputSchema(updateCategorySchema)
  .action(async ({ parsedInput, ctx }) => {
    const row = await updateCategory(ctx.userId, parsedInput);
    revalidateAfterCategory(ctx.userId);
    return row;
  });

export const archiveCategoryAction = authedAction
  .metadata({ actionName: 'archiveCategory' })
  .inputSchema(deleteCategorySchema)
  .action(async ({ parsedInput, ctx }) => {
    const row = await archiveCategory(ctx.userId, parsedInput.id);
    revalidateAfterCategory(ctx.userId);
    return row;
  });

export const seedDefaultCategoriesAction = authedAction
  .metadata({ actionName: 'seedDefaultCategories' })
  .inputSchema(z.object({}))
  .action(async ({ ctx }) => {
    const rows = await seedDefaultCategoriesIfEmpty(ctx.userId);
    revalidateAfterCategory(ctx.userId);
    return rows;
  });
