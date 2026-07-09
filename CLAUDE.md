# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

Concrete Next.js 16 differences already in use here: middleware lives in `src/proxy.ts` (not `middleware.ts`), and `revalidateTag(tag, 'max')` takes a cache-profile second argument. When unsure about an API, check `node_modules/next/dist/docs/` (requires `pnpm install`).

## Commands

Package manager is **pnpm**.

```bash
pnpm dev          # dev server on :3000 (Turbopack)
pnpm build        # production build — uses --webpack on purpose (Serwist needs it)
pnpm typecheck    # tsc --noEmit
pnpm check        # Biome lint + format with autofix (Biome replaces ESLint+Prettier)
pnpm test         # Vitest unit tests
pnpm test:e2e     # Playwright (auto-starts dev server; locale es-CO, tz America/Bogota)
pnpm db:generate  # generate SQL migrations from Drizzle schema
pnpm db:migrate   # apply migrations to Neon
pnpm db:studio    # Drizzle Studio
```

Run a single test file: `pnpm vitest run src/features/transactions/__tests__/domain.test.ts`
Filter by name: `pnpm vitest run -t "nombre del test"`

Husky pre-commit runs `lint-staged` → `biome check --write` on staged files. Drizzle reads `DATABASE_URL_UNPOOLED` (falls back to `DATABASE_URL`) from `.env.local`. Env vars are validated in `src/env.ts` (@t3-oss/env-nextjs) — add new ones there, not just in `.env`.

## Language

UI text, comments, commit messages, and routes are in **Spanish** (`/transacciones`, `/cuentas`, `/deudas`, `/ahorros`, `/presupuestos`, …). Keep it that way.

## Architecture

Vertical slices in `src/features/<feature>/`, each with: `schema.ts` (Zod), `queries.ts` (read-only Drizzle), `mutations.ts` (writes), `actions.ts` (next-safe-action wrappers), `domain.ts` (pure testable logic), `components/`, `__tests__/`.

Mutation flow: Form (RHF + Zod) → `useAction` → `actions.ts` (thin: `authedAction` from `src/lib/safe-action.ts` provides `ctx.userId`, then delegates) → `mutations.ts` (`import 'server-only'`, Drizzle) → `domain.ts` for pure calculations. After every mutation, call the matching `revalidateAfter*` helper from `src/lib/cache-tags.ts` — it centralizes all `revalidateTag`/`revalidatePath` calls; never sprinkle revalidation inline.

### Accounting engine (`src/lib/accounting/`)

The single source of truth for balances, totals, and "does this count as expense/income this month". Two entry points:

- `@/lib/accounting` — server-only (DB queries: balances, debt/savings/credit-card state, period totals).
- `@/lib/accounting/shared` — client-safe re-exports (kinds, period bounds, deltas, virtuals). Never import the server index from a Client Component.

Transaction `kind` (`expense`, `income`, `transfer`, `cc_charge`, `cc_payment`, `loan_payment`, `loan_charge`, `savings_contribution`, `refund`) drives all accounting. Any query asking "is this an expense of the month?" must go through `kinds.ts` (`EXPENSE_KINDS`, etc.) — note cash-basis rules: `cc_payment`/`loan_payment`/`savings_contribution` count as expenses, `cc_charge` and `transfer` do not.

### Recurring transactions

Two complementary mechanisms, with a strict invariant to avoid double-counting:

- **Real materialization** (`features/transactions/materialize.ts`): daily Vercel cron plus lazy on-load self-healing (`ensureRecurringMaterialized`) insert real rows for due occurrences. Idempotent via partial unique index + `onConflictDoNothing`.
- **Virtual occurrences** (`lib/accounting/virtuals.ts`): future occurrences projected in memory, never persisted. They always start from `recurringRules.nextOccurrenceDate` (which points to the next *unmaterialized* occurrence), guaranteeing virtuals are disjoint from real rows.

## Golden rules

1. **Never `number` for money.** DB stores `bigint` minor units (centavos); runtime uses Dinero.js v2 exclusively through `src/lib/money.ts` (the only file that imports Dinero). Display via `Intl.NumberFormat`.
2. **Never mix currencies** without explicit conversion (Frankfurter API via `features/exchange`).
3. **Never import `db` from a Client Component.** `mutations.ts`/`queries.ts` start with `import 'server-only'`.
4. Use branded IDs from `src/types/ids.ts` (`UserId`, `AccountId`, …) instead of raw strings.
5. Pure logic goes in `domain.ts` — testable without DB or mocks. Server Actions stay thin: auth + parse + delegate.
6. All user data is scoped by `userId` — every query/mutation takes it as first argument.

## Misc

- `scripts/` has DB utilities run with tsx: `db-inspect.ts`, `db-reset.ts`, `clean-db.ts`, `nuke-db.ts` (destructive — ask first).
- PWA via Serwist: service worker source is `src/app/sw.ts`, disabled in dev; generated `public/sw.js` and workbox files are gitignored/Biome-ignored — never edit them.
- Theme is dark-first OKLCH purple in `src/app/globals.css`; UI primitives in `src/components/ui/` follow shadcn patterns.
