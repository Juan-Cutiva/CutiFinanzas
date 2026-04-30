import { PiggyBank } from 'lucide-react';
import type { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Metas de ahorro' };

export default function AhorrosPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Metas de ahorro</h2>
        <p className="text-sm text-muted-foreground">
          Define objetivos y aporta cada mes para alcanzarlos.
        </p>
      </header>

      <Card>
        <CardHeader className="items-center text-center">
          <PiggyBank className="size-10 text-muted-foreground/50" aria-hidden />
          <CardTitle>¿Cuál es tu próxima meta?</CardTitle>
          <CardDescription>
            Fondo de emergencia, viaje, computador nuevo… empieza por una y agrega más después.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
