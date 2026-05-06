import type { Metadata } from 'next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getOrCreateUser } from '@/db/queries/users';
import { env } from '@/env';
import { listAccountsByUser } from '@/features/accounts/queries';
import { CategoryList } from '@/features/categories/components/category-list';
import { CreateCategoryButton } from '@/features/categories/components/create-category-button';
import { SeedDefaultCategoriesButton } from '@/features/categories/components/seed-button';
import { listCategoriesByUser } from '@/features/categories/queries';
import { PushToggle } from '@/features/notifications/components/push-toggle';
import { PreferencesForm } from '@/features/settings/components/preferences-form';
import type { UserId } from '@/types/ids';

export const metadata: Metadata = { title: 'Ajustes' };
export const dynamic = 'force-dynamic';

export default async function AjustesPage() {
  const user = await getOrCreateUser();
  const userId = user.id as UserId;
  const [categories, accounts] = await Promise.all([
    listCategoriesByUser(userId),
    listAccountsByUser(userId),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Ajustes</h2>
        <p className="text-sm text-muted-foreground">Tu perfil, preferencias y categorías.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Perfil y preferencias</CardTitle>
          <CardDescription>Define tu moneda, idioma, zona horaria y días de cobro.</CardDescription>
        </CardHeader>
        <CardContent>
          <PreferencesForm
            defaults={{
              name: user.name,
              defaultCurrency: user.defaultCurrency,
              locale: user.locale,
              timezone: user.timezone,
              payAnchorDates: user.payAnchorDates ?? [6, 21],
              primaryAccountId: user.primaryAccountId ?? null,
              dashboardAccountIds: user.dashboardAccountIds ?? null,
            }}
            accounts={accounts.map((a) => ({ id: a.id, name: a.name, type: a.type }))}
          />
          <p className="mt-4 text-xs text-muted-foreground">
            Correo: <span className="font-mono">{user.email}</span> (gestionado por Clerk).
          </p>
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
            <div className="flex flex-wrap gap-2">
              {categories.length === 0 ? <SeedDefaultCategoriesButton /> : null}
              <CreateCategoryButton />
            </div>
          </div>
        </CardHeader>
        {categories.length > 0 ? (
          <CardContent className="pt-0">
            <CategoryList
              items={categories.map((c) => ({ id: c.id, name: c.name, color: c.color }))}
            />
          </CardContent>
        ) : (
          <CardContent />
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notificaciones</CardTitle>
          <CardDescription>
            Recibe un recordatorio cuando se acerquen pagos próximos o vencidos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PushToggle vapidPublicKey={env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Exportar</CardTitle>
          <CardDescription>
            Descarga una copia completa de tus datos en Excel o JSON.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild>
            <a href="/api/export/excel" download>
              Exportar a Excel
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href="/api/export/json" download>
              Exportar JSON
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
