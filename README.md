# CutiFinanzas

App web/PWA de finanzas personales — reemplazo del Excel mensual con control completo de
ingresos, gastos por quincena, presupuestos, deudas, metas de ahorro y reporte mensual en PDF.

## Stack

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript
- **DB:** Neon Postgres + Drizzle ORM
- **Auth:** Clerk (locale `esES`)
- **UI:** Tailwind CSS v4 + shadcn/ui patterns + paleta morada `#572364` en OKLCH (dark first)
- **Validación:** Zod + React Hook Form
- **Server Actions:** next-safe-action
- **PWA:** Serwist (sucesor de next-pwa)
- **PDF:** @react-pdf/renderer
- **Charts:** Recharts (a través de shadcn Charts)
- **Tests:** Vitest + Playwright + Testing Library
- **Lint/Format:** Biome (reemplaza ESLint+Prettier)
- **Deploy:** Vercel

## Setup

```bash
pnpm install
cp .env.example .env.local      # configurar variables
pnpm db:push                    # sincroniza schema a Neon (dev)
pnpm dev                        # arranca en :3000
```

## Scripts

| Comando | Descripción |
|---|---|
| `pnpm dev` | Servidor de desarrollo (Turbopack) |
| `pnpm build` | Build de producción |
| `pnpm typecheck` | TypeScript estricto |
| `pnpm check` | Biome (lint + format con autofix) |
| `pnpm test` | Vitest unit/integración |
| `pnpm test:e2e` | Playwright |
| `pnpm db:generate` | Genera SQL desde schema Drizzle |
| `pnpm db:migrate` | Aplica migraciones |
| `pnpm db:studio` | Abre Drizzle Studio |

## Arquitectura

Vertical slices en `src/features/<feature>/` con esta estructura por slice:

```
src/features/transactions/
├─ schema.ts        # Zod schemas (input/output)
├─ queries.ts       # SELECTs Drizzle (read-only)
├─ mutations.ts     # INSERTs/UPDATEs (server-only)
├─ actions.ts       # next-safe-action wrappers
├─ domain.ts        # lógica pura testeable
├─ components/      # UI específica del slice
└─ __tests__/       # tests unitarios
```

Flujo de datos en mutaciones:

```
Form (RHF + Zod) → useAction (next-safe-action)
                          ↓
                   actions.ts        ← thin: auth + parse + delegar
                          ↓
                   mutations.ts      ← server-only + Drizzle
                          ↓ (usa)
                   domain.ts         ← funciones puras (cálculos, reglas)
                          ↓
                   db/schema         ← single source of truth de tipos
```

## Manejo de dinero

- Postgres: `bigint` con valor en **menor unidad** (centavos en COP/USD/EUR…).
- Runtime: **Dinero.js v2** vía `lib/money.ts` (único punto que importa Dinero).
- Display: `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' })`.
- Multi-moneda con conversión vía API pública [Frankfurter](https://www.frankfurter.dev/).

## Estructura

```
src/
├─ app/              # rutas App Router
│  ├─ (app)/         # rutas autenticadas con shell (sidebar/bottomnav)
│  ├─ sign-in/       # Clerk
│  ├─ sign-up/       # Clerk
│  ├─ offline/       # fallback PWA
│  ├─ layout.tsx     # ClerkProvider + ThemeProvider
│  ├─ page.tsx       # landing (redirect a /dashboard si autenticado)
│  ├─ manifest.ts    # PWA manifest
│  ├─ sw.ts          # service worker (Serwist)
│  └─ globals.css    # tema OKLCH morado dark/light
├─ components/
│  ├─ ui/            # primitives (Button, Card, …)
│  └─ layout/        # Sidebar, BottomNav, Header, ThemeToggle, FAB
├─ features/         # vertical slices por dominio
├─ db/
│  ├─ schema/        # tablas Drizzle (split por dominio)
│  └─ client.ts      # neon-http + drizzle()
├─ lib/              # money, format, utils, errors, auth, safe-action
├─ types/            # branded IDs
├─ env.ts            # @t3-oss/env-nextjs (validación)
└─ proxy.ts          # Clerk middleware (Next.js 16: proxy.ts, no middleware.ts)
```

## Reglas de oro

1. **Nunca** uses `number` para dinero. Siempre `bigint` en DB y `Money` (Dinero) en runtime.
2. **Nunca** importes `db` desde un Client Component. Marca `mutations.ts` / `queries.ts` con
   `import 'server-only'` al tope.
3. **Nunca** combines monedas distintas sin convertir explícitamente.
4. Lógica pura en `domain.ts` — testeable sin DB ni mocks.
5. Server Actions thin: auth + parse + delegar a `mutations.ts`.

## Licencia

Privado — uso personal.
