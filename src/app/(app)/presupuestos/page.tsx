import { Target } from 'lucide-react';
import type { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Presupuestos' };

export default function PresupuestosPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Presupuestos</h2>
        <p className="text-sm text-muted-foreground">
          Define cuánto puedes gastar por categoría cada mes.
        </p>
      </header>

      <Card>
        <CardHeader className="items-center text-center">
          <Target className="size-10 text-muted-foreground/50" aria-hidden />
          <CardTitle>Sin presupuestos aún</CardTitle>
          <CardDescription>
            Crea tu primer presupuesto cuando hayas definido tus categorías.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
