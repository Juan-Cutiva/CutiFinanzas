'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/db/client';
import { accounts, budgets, categories, debts, savingsGoals, transactions } from '@/db/schema';
import type { CurrencyCode } from '@/lib/money';
import { authedAction } from '@/lib/safe-action';
import { amountMajorToMinor, getQuincenaFromIsoDate } from '../transactions/domain';
import { parseExcel } from './excel-parser';

export const importExcelAction = authedAction
  .metadata({ actionName: 'importExcel' })
  .inputSchema(z.object({ fileBase64: z.string().min(1) }))
  .action(async ({ parsedInput, ctx }) => {
    const buffer = Buffer.from(parsedInput.fileBase64, 'base64');
    const ab = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer;
    const parsed = await parseExcel(ab);

    const [user] = await db.select().from(accounts).where(eq(accounts.userId, ctx.userId)).limit(1);
    const defaultCurrency = (parsed ? 'COP' : 'COP') as CurrencyCode;

    let primaryAccountId: string | null = user?.id ?? null;
    if (!primaryAccountId) {
      const [acc] = await db
        .insert(accounts)
        .values({
          userId: ctx.userId,
          name: 'Cuenta principal (importada)',
          type: 'cash',
          currency: defaultCurrency,
        })
        .returning();
      primaryAccountId = acc?.id ?? null;
    }
    if (!primaryAccountId) throw new Error('No se pudo crear cuenta principal');

    const existingCategories = await db
      .select()
      .from(categories)
      .where(eq(categories.userId, ctx.userId));
    const categoryMap = new Map<string, string>();
    for (const c of existingCategories) categoryMap.set(c.name.toLowerCase(), c.id);

    async function categoryIdFor(name: string): Promise<string | null> {
      if (!name) return null;
      const key = name.toLowerCase();
      if (categoryMap.has(key)) return categoryMap.get(key) ?? null;
      const [created] = await db
        .insert(categories)
        .values({ userId: ctx.userId, name })
        .returning();
      if (!created) return null;
      categoryMap.set(key, created.id);
      return created.id;
    }

    const stats = {
      transactions: 0,
      budgets: 0,
      debts: 0,
      savingsGoals: 0,
    };

    for (const fx of parsed.fixedExpenses) {
      const catId = await categoryIdFor(fx.category);
      const today = new Date();
      const day = Math.min(
        fx.payDay,
        new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate(),
      );
      const occurredAt = new Date(today.getFullYear(), today.getMonth(), day)
        .toISOString()
        .slice(0, 10);
      await db.insert(transactions).values({
        userId: ctx.userId,
        accountId: primaryAccountId,
        categoryId: catId,
        kind: 'expense_fixed',
        amountMinor: amountMajorToMinor(fx.amount, defaultCurrency),
        currency: defaultCurrency,
        occurredAt,
        description: fx.description || fx.category,
        notes: fx.notes ?? null,
        isPaid: false,
        quincena: getQuincenaFromIsoDate(occurredAt),
      });
      stats.transactions++;
    }

    for (const v of parsed.variableExpenses) {
      const catId = await categoryIdFor(v.category);
      await db.insert(transactions).values({
        userId: ctx.userId,
        accountId: primaryAccountId,
        categoryId: catId,
        kind: 'expense_variable',
        amountMinor: amountMajorToMinor(v.amount, defaultCurrency),
        currency: defaultCurrency,
        occurredAt: v.occurredAt,
        description: v.subcategory || v.category,
        notes: v.notes ?? null,
        isPaid: true,
        quincena: v.quincena,
      });
      stats.transactions++;
    }

    for (const i of parsed.income) {
      await db.insert(transactions).values({
        userId: ctx.userId,
        accountId: primaryAccountId,
        kind: 'income_fixed',
        amountMinor: amountMajorToMinor(i.amount, defaultCurrency),
        currency: defaultCurrency,
        occurredAt: i.occurredAt,
        description: i.type,
        notes: i.notes ?? null,
        isPaid: true,
        quincena: i.quincena,
      });
      stats.transactions++;
    }

    const monthNow = new Date();
    for (const b of parsed.budgets) {
      const catId = await categoryIdFor(b.category);
      if (!catId) continue;
      await db
        .insert(budgets)
        .values({
          userId: ctx.userId,
          categoryId: catId,
          year: monthNow.getFullYear(),
          month: monthNow.getMonth() + 1,
          period: 'monthly',
          amountMinor: amountMajorToMinor(b.amount, defaultCurrency),
          currency: defaultCurrency,
        })
        .onConflictDoNothing();
      stats.budgets++;
    }

    for (const d of parsed.debts) {
      await db.insert(debts).values({
        userId: ctx.userId,
        name: d.name,
        initialAmountMinor: amountMajorToMinor(d.initial, defaultCurrency),
        currentBalanceMinor: amountMajorToMinor(d.current, defaultCurrency),
        currency: defaultCurrency,
        interestRateAnnual: d.rateAnnual !== null ? String(d.rateAnnual) : null,
        monthlyPaymentMinor: amountMajorToMinor(d.monthly, defaultCurrency),
        startDate: d.startDate,
        endDate: d.endDate,
      });
      stats.debts++;
    }

    for (const g of parsed.savingsGoals) {
      await db.insert(savingsGoals).values({
        userId: ctx.userId,
        name: g.name,
        targetAmountMinor: amountMajorToMinor(g.target, defaultCurrency),
        currentAmountMinor: amountMajorToMinor(g.current, defaultCurrency),
        monthlyContributionMinor: amountMajorToMinor(g.monthly, defaultCurrency),
        currency: defaultCurrency,
        startDate: g.startDate,
        targetDate: g.targetDate,
      });
      stats.savingsGoals++;
    }

    revalidatePath('/dashboard');
    revalidatePath('/transacciones');
    revalidatePath('/cuentas');
    revalidatePath('/presupuestos');
    revalidatePath('/deudas');
    revalidatePath('/ahorros');

    return stats;
  });
