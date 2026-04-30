import type { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getOrCreateUser } from '@/db/queries/users';
import { CategoryList } from '@/features/categories/components/category-list';
import { CreateCategoryButton } from '@/features/categories/components/create-category-button';
import { SeedDefaultCategoriesButton } from '@/features/categories/components/seed-button';
import { listCategoriesByUser } from '@/features/categories/queries';
import { PreferencesForm } from '@/features/settings/components/preferences-form';

export const metadata: Metadata = { title: 'Ajustes' };
export const dynamic = 'force-dynamic';

export default async function AjustesPage() {
  const user = await getOrCreateUser();
  const categories = await listCategoriesByUser(user.id as never);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Ajustes</h2>
        <p className="text-sm text-muted-foreground">Tu perfil, preferencias y categorías.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Perfil y preferencias</CardTitle>
          <CardDescription>
            Define tu moneda, idioma y zona horaria predeterminados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PreferencesForm
            defaults={{
              name: user.name,
              defaultCurrency: user.defaultCurrency,
              locale: user.locale,
              timezone: user.timezone,
              payFrequency: user.payFrequency as 'weekly' | 'biweekly' | 'monthly',
            }}
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
    </div>
  );
}
