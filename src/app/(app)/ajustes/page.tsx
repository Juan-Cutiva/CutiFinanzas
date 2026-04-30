import type { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getOrCreateUser } from '@/db/queries/users';
import { SeedDefaultCategoriesButton } from '@/features/categories/components/seed-button';
import { listCategoriesByUser } from '@/features/categories/queries';

export const metadata: Metadata = { title: 'Ajustes' };
export const dynamic = 'force-dynamic';

export default async function AjustesPage() {
  const user = await getOrCreateUser();
  const categories = await listCategoriesByUser(user.id as never);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Ajustes</h2>
        <p className="text-sm text-muted-foreground">
          Preferencias, categorías y datos de tu cuenta.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Perfil</CardTitle>
          <CardDescription>Datos que vienen de tu cuenta de Clerk.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Nombre</span>
            <span>{user.name ?? '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Correo</span>
            <span className="truncate">{user.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Moneda predeterminada</span>
            <span className="font-mono uppercase">{user.defaultCurrency}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Zona horaria</span>
            <span>{user.timezone}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Categorías</CardTitle>
              <CardDescription>
                {categories.length === 0
                  ? 'Crea las categorías iniciales para clasificar tus gastos.'
                  : `${categories.length} categoría${categories.length === 1 ? '' : 's'} activa${categories.length === 1 ? '' : 's'}.`}
              </CardDescription>
            </div>
            {categories.length === 0 ? <SeedDefaultCategoriesButton /> : null}
          </div>
        </CardHeader>
        {categories.length > 0 ? (
          <CardContent className="pt-0">
            <ul className="grid gap-2 sm:grid-cols-2">
              {categories.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/30 px-3 py-2"
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: c.color }}
                    aria-hidden
                  />
                  <span className="truncate text-sm">{c.name}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        ) : (
          <CardContent />
        )}
      </Card>
    </div>
  );
}
