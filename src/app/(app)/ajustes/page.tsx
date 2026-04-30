import type { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Ajustes' };

export default function AjustesPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Ajustes</h2>
        <p className="text-sm text-muted-foreground">
          Preferencias de moneda, zona horaria, notificaciones y categorías.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Próximamente</CardTitle>
          <CardDescription>
            Pronto podrás cambiar moneda predeterminada, gestionar categorías, exportar tu data y
            configurar recordatorios push.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
